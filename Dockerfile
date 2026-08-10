# Build Stage (.NET 8 SDK)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files
COPY ["backend/QuizMaster.Core/QuizMaster.Core.csproj", "backend/QuizMaster.Core/"]
COPY ["backend/QuizMaster.Infrastructure/QuizMaster.Infrastructure.csproj", "backend/QuizMaster.Infrastructure/"]
COPY ["backend/QuizMaster.Api/QuizMaster.Api.csproj", "backend/QuizMaster.Api/"]

RUN dotnet restore "backend/QuizMaster.Api/QuizMaster.Api.csproj"

# Copy source code and publish
COPY backend/ backend/
WORKDIR "/src/backend/QuizMaster.Api"
RUN dotnet publish "QuizMaster.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage (.NET 8 ASP.NET Runtime)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "QuizMaster.Api.dll"]
