# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy Solution & Projects
COPY ["QuizMaster.slnx", "./"]
COPY ["QuizMaster.Core/QuizMaster.Core.csproj", "QuizMaster.Core/"]
COPY ["QuizMaster.Infrastructure/QuizMaster.Infrastructure.csproj", "QuizMaster.Infrastructure/"]
COPY ["QuizMaster.Api/QuizMaster.Api.csproj", "QuizMaster.Api/"]
COPY ["QuizMaster.Tests/QuizMaster.Tests.csproj", "QuizMaster.Tests/"]

RUN dotnet restore "QuizMaster.Api/QuizMaster.Api.csproj"

COPY . .
WORKDIR "/src/QuizMaster.Api"
RUN dotnet publish "QuizMaster.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "QuizMaster.Api.dll"]
