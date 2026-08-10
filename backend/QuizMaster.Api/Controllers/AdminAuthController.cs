using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizMaster.Api.Services;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Controllers;

[ApiController]
[Route("api/admin/auth")]
public class AdminAuthController : ControllerBase
{
    private readonly IQuizRepository _repository;
    private readonly ITokenService _tokenService;
    private readonly IConfiguration _configuration;

    public AdminAuthController(
        IQuizRepository repository,
        ITokenService tokenService,
        IConfiguration configuration)
    {
        _repository = repository;
        _tokenService = tokenService;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AdminLoginResponse>> Login([FromBody] AdminLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username and password are required." });
        }

        try { await _repository.EnsureDatabaseCreatedAsync(); } catch { }

        var admin = await _repository.GetAdminByUsernameAsync(request.Username);
        
        // If admin table is empty, auto-seed default admin credentials from config
        if (admin == null && request.Username.Equals("admin", StringComparison.OrdinalIgnoreCase))
        {
            var defaultPassword = _configuration["Admin:DefaultPassword"] ?? "Admin@Quiz2026";
            if (request.Password == defaultPassword)
            {
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                admin = new AdminUser
                {
                    Username = "admin",
                    PasswordHash = passwordHash,
                    Role = "Admin"
                };
                await _repository.CreateAdminAsync(admin);
            }
        }

        if (admin == null || !BCrypt.Net.BCrypt.Verify(request.Password, admin.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password." });
        }

        var token = _tokenService.GenerateToken(admin);

        return Ok(new AdminLoginResponse
        {
            Token = token,
            Username = admin.Username,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult GetCurrentUser()
    {
        var username = User.Identity?.Name;
        return Ok(new { username, role = "Admin", authenticated = true });
    }
}
