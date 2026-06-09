interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Tomorrow.io MCP — wraps the Tomorrow.io Weather API (api.tomorrow.io/v4)
 *
 * Tools:
 * - realtime: current weather conditions for a location
 * - forecast: daily or hourly forecast for a location
 *
 * Auth: simple API key. Caller passes the key as `_apiKey` (optional — the
 * gateway injects the platform key when omitted). The key is sent as the
 * `apikey=<key>` query param. Get a free key at tomorrow.io (500 calls/day).
 */


const BASE_URL = 'https://api.tomorrow.io/v4';

const USER_AGENT = 'pipeworx/1.0 (+https://pipeworx.io)';

// Tomorrow.io weatherCode → human-readable description. Covers the common
// codes; unknown codes fall back to the numeric code rendered as a string.
const WEATHER_CODES: Record<number, string> = {
  0: 'Unknown',
  1000: 'Clear',
  1100: 'Mostly Clear',
  1101: 'Partly Cloudy',
  1102: 'Mostly Cloudy',
  1001: 'Cloudy',
  2000: 'Fog',
  2100: 'Light Fog',
  4000: 'Drizzle',
  4001: 'Rain',
  4200: 'Light Rain',
  4201: 'Heavy Rain',
  5000: 'Snow',
  5001: 'Flurries',
  5100: 'Light Snow',
  5101: 'Heavy Snow',
  6000: 'Freezing Drizzle',
  6001: 'Freezing Rain',
  7000: 'Ice Pellets',
  8000: 'Thunderstorm',
};

function describeWeatherCode(code: number | undefined): string | undefined {
  if (code === undefined || code === null) return undefined;
  return WEATHER_CODES[code] ?? String(code);
}

const tools: McpToolExport['tools'] = [
  {
    name: 'realtime',
    description:
      'Get current/real-time weather conditions for a location — temperature, feels-like, humidity, wind, precipitation probability, cloud cover, UV index, and visibility. Location can be "lat,lon" coordinates or a city name. Example: realtime({ location: "new york", units: "imperial" }) or realtime({ location: "40.71,-74.01" })',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'Location to look up — either "lat,lon" coordinates (e.g. "40.71,-74.01") or a city name (e.g. "new york", "london")',
        },
        units: {
          type: 'string',
          description: 'Unit system: "metric" (default) or "imperial"',
        },
        _apiKey: {
          type: 'string',
          description:
            'Tomorrow.io API key (optional — get a free one at tomorrow.io; if omitted the platform key is used)',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'forecast',
    description:
      'Get a daily or hourly weather forecast for a location. Returns a list of forecast periods with conditions, temperatures, precipitation probability, and wind. Location can be "lat,lon" coordinates or a city name. Example: forecast({ location: "london", timestep: "1d", units: "metric" })',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'Location to look up — either "lat,lon" coordinates (e.g. "40.71,-74.01") or a city name (e.g. "new york")',
        },
        timestep: {
          type: 'string',
          description: 'Forecast granularity: "1d" daily (default) or "1h" hourly',
        },
        units: {
          type: 'string',
          description: 'Unit system: "metric" (default) or "imperial"',
        },
        _apiKey: {
          type: 'string',
          description:
            'Tomorrow.io API key (optional — get a free one at tomorrow.io; if omitted the platform key is used)',
        },
      },
      required: ['location'],
    },
  },
];

// Shared error formatter — make 429 + auth failures actionable. Tomorrow.io
// returns 429 when the free quota (500/day, ~25/hour) is exhausted.
function tomorrowError(status: number): { error: string } {
  if (status === 429) {
    return { error: 'Tomorrow.io rate limit (free tier 500/day); try again later' };
  }
  if (status === 401 || status === 403) {
    return { error: 'Tomorrow.io auth error (check key)' };
  }
  return { error: `Tomorrow.io error: ${status}` };
}

interface TomorrowValues {
  temperature?: number;
  temperatureApparent?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  windSpeed?: number;
  windDirection?: number;
  weatherCode?: number;
  precipitationProbability?: number;
  cloudCover?: number;
  uvIndex?: number;
  visibility?: number;
  pressureSurfaceLevel?: number;
}

interface TomorrowLocation {
  lat?: number;
  lon?: number;
  name?: string;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string | undefined;
  delete args._apiKey;

  if (!apiKey) {
    return { error: 'Tomorrow.io requires an API key via _apiKey or the platform key' };
  }

  try {
    switch (name) {
      case 'realtime':
        return await realtime(args.location as string, (args.units as string) ?? 'metric', apiKey);
      case 'forecast':
        return await forecast(
          args.location as string,
          (args.timestep as string) ?? '1d',
          (args.units as string) ?? 'metric',
          apiKey,
        );
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function realtime(location: string, units: string, apiKey: string) {
  const params = new URLSearchParams({ location, units, apikey: apiKey });
  const res = await fetch(`${BASE_URL}/weather/realtime?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return tomorrowError(res.status);

  const body = (await res.json()) as {
    data?: { time?: string; values?: TomorrowValues };
    location?: TomorrowLocation;
  };

  const values = body.data?.values ?? {};

  return {
    location: body.location?.name ?? location,
    time: body.data?.time,
    conditions: describeWeatherCode(values.weatherCode),
    temperature: values.temperature,
    feels_like: values.temperatureApparent,
    humidity: values.humidity,
    wind_speed: values.windSpeed,
    wind_direction: values.windDirection,
    precip_probability: values.precipitationProbability,
    cloud_cover: values.cloudCover,
    uv_index: values.uvIndex,
    visibility: values.visibility,
    units,
  };
}

async function forecast(location: string, timestep: string, units: string, apiKey: string) {
  const params = new URLSearchParams({ location, timesteps: timestep, units, apikey: apiKey });
  const res = await fetch(`${BASE_URL}/weather/forecast?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return tomorrowError(res.status);

  const body = (await res.json()) as {
    timelines?: {
      hourly?: Array<{ time?: string; values?: TomorrowValues }>;
      daily?: Array<{ time?: string; values?: TomorrowValues }>;
    };
    location?: TomorrowLocation;
  };

  const series =
    timestep === '1d' ? body.timelines?.daily ?? [] : body.timelines?.hourly ?? [];

  const periods = series.slice(0, 16).map((p) => {
    const values = p.values ?? {};
    return {
      time: p.time,
      conditions: describeWeatherCode(values.weatherCode),
      temp_min: values.temperatureMin,
      temp_max: values.temperatureMax,
      temperature: values.temperature,
      precip_probability: values.precipitationProbability,
      wind_speed: values.windSpeed,
    };
  });

  return {
    location: body.location?.name ?? location,
    timestep,
    periods,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
