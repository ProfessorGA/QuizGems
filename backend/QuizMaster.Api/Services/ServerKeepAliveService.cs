namespace QuizMaster.Api.Services;

public class ServerKeepAliveService : BackgroundService
{
    private readonly ILogger<ServerKeepAliveService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public ServerKeepAliveService(
        ILogger<ServerKeepAliveService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Quiz Master Standby Keep-Alive Service started. Maintaining 4+ hour live competition standby.");

        using var periodicTimer = new PeriodicTimer(TimeSpan.FromMinutes(4));

        while (!stoppingToken.IsCancellationRequested && await periodicTimer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(10);

                var externalUrl = Environment.GetEnvironmentVariable("RENDER_EXTERNAL_URL")
                    ?? _configuration["ApiBaseUrl"]
                    ?? "https://quizmaster-api-bdtt.onrender.com";

                var response = await client.GetAsync($"{externalUrl}/health", stoppingToken);
                _logger.LogInformation("Standby Keep-Alive heartbeat sent to {Url}: Status {StatusCode}", externalUrl, response.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Keep-Alive self-ping notice: {Message}", ex.Message);
            }
        }
    }
}
