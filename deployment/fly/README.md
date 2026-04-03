# Fly.io deployment sample

1. Install Flyctl and authenticate.
2. Set secrets:

```bash
fly secrets set BEARER_TOKEN=replace-me
```

3. Deploy:

```bash
fly deploy -c deployment/fly/fly.toml
```
