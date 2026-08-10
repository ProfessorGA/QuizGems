using Microsoft.EntityFrameworkCore;
using QuizMaster.Core.Entities;

namespace QuizMaster.Infrastructure.Data;

public class QuizDbContext : DbContext
{
    public QuizDbContext(DbContextOptions<QuizDbContext> options) : base(options)
    {
    }

    public DbSet<QuizSession> Sessions => Set<QuizSession>();
    public DbSet<QuizParticipant> Participants => Set<QuizParticipant>();
    public DbSet<QuizQuestion> Questions => Set<QuizQuestion>();
    public DbSet<QuizAnswer> Answers => Set<QuizAnswer>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // QuizSession configuration
        modelBuilder.Entity<QuizSession>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.SessionCode).IsUnique();
            entity.Property(e => e.SessionCode).HasMaxLength(20).IsRequired();
            entity.Property(e => e.SessionName).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Status).HasConversion<int>();

            entity.HasMany(e => e.Participants)
                .WithOne(p => p.Session)
                .HasForeignKey(p => p.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Questions)
                .WithOne(q => q.Session)
                .HasForeignKey(q => q.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Answers)
                .WithOne(a => a.Session)
                .HasForeignKey(a => a.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // QuizParticipant configuration
        modelBuilder.Entity<QuizParticipant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => new { e.SessionId, e.FullName });
            entity.Property(e => e.FullName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.ConnectionId).HasMaxLength(100);

            entity.HasMany(e => e.Answers)
                .WithOne(a => a.Participant)
                .HasForeignKey(a => a.ParticipantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // QuizQuestion configuration
        modelBuilder.Entity<QuizQuestion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => new { e.SessionId, e.QuestionNumber }).IsUnique();
            entity.Property(e => e.Status).HasConversion<int>();

            entity.HasMany(e => e.Answers)
                .WithOne(a => a.Question)
                .HasForeignKey(a => a.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // QuizAnswer configuration
        modelBuilder.Entity<QuizAnswer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.QuestionId);
            entity.HasIndex(e => e.ParticipantId);
            entity.HasIndex(e => new { e.QuestionId, e.ParticipantId }).IsUnique(); // One answer per participant per question
        });

        // AdminUser configuration
        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.Property(e => e.Username).HasMaxLength(50).IsRequired();
            entity.Property(e => e.PasswordHash).IsRequired();
        });
    }
}
