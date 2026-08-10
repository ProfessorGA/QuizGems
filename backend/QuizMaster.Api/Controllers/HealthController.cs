using Microsoft.AspNetCore.Mvc;

namespace QuizMaster.Api.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public ActionResult GetHealth()
    {
        return Ok(new
        {
            status = "healthy",
            service = "QuizMaster Physical Quiz Competition Platform",
            version = "1.0.0",
            serverTimeUtc = DateTime.UtcNow
        });
    }
}
