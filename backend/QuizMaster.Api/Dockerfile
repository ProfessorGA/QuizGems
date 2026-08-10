# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["QuizMaster.Core/QuizMaster.Core.csproj", "QuizMaster.Core/"]
COPY ["QuizMaster.Infrastructure/QuizMaster.Infrastructure.csproj", "QuizMaster.Infrastructure/"]
COPY ["QuizMaster.Api/QuizMaster.Api.csproj", "QuizMaster.Api/"]

RUN dotnet restore "QuizMaster.Api/QuizMaster.Api.csproj"

# Copy full source and build
COPY . .
WORKDIR "/src/QuizMaster.Api"
RUN dotnet build "QuizMaster.Api.csproj" -c Release -o /app/build
RUN dotnet publish "QuizMaster.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render assigns port dynamically via $PORT
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "QuizMaster.Api.dll"]
