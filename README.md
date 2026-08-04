# mcp-tomorrow-io

Tomorrow.io MCP — wraps the Tomorrow.io Weather API (api.tomorrow.io/v4)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `realtime` | Get current/real-time weather conditions for a location — temperature, feels-like, humidity, wind, precipitation probability, cloud cover, UV index, and visibility. Location can be "lat,lon" coordinates or a city name. Example: realtime({ location: "new york", units: "imperial" }) or realtime({ location: "40.71,-74.01" }) |
| `forecast` | Get a daily or hourly weather forecast for a location. Returns a list of forecast periods with conditions, temperatures, precipitation probability, and wind. Location can be "lat,lon" coordinates or a city name. Example: forecast({ location: "london", timestep: "1d", units: "metric" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "tomorrow-io": {
      "url": "https://gateway.pipeworx.io/tomorrow-io/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Tomorrow Io data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
