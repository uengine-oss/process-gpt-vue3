# process-gpt-vue3

# Run

### with Docker Compose
start docker compose
```
docker-compose up -d
```
stop docker compose
```
docker-compose down
```

# Install

### supabase Initial Script

#### Easy way:
Using CLI and docker :  https://supabase.com/docs/guides/cli/getting-started
```
supabase init
supabase start
```
and navigate to the 

http://localhost:54323


#### Complex way:

```sh
# Get the code
git clone --depth 1 https://github.com/supabase/supabase

# Go to the docker folder
cd supabase/docker

# Copy the fake env vars
cp .env.example .env

# Pull the latest images
docker compose pull

# Start the services (in detached mode)
docker compose up -d
```

### Process GPT Initial Script
```sh
# 해당 PW값은 .env의 ANON_KEY 참고.

docker run -p 8080:8080 -e DB_URL=http://localhost:8000 -e DB_PW=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```


#### Don't forget to set the OPENAI_API_KEY for configuration:

- navigate to the supabase console:
http://localhost:54323

- find the configuration table and set the openai_key field as value set:
```
{
  "key": "sk-..."
}
```
