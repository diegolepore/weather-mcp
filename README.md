# Weather MCP Server

A TypeScript MCP server that gives any MCP-compatible AI client (Claude Desktop, Cursor, and others) live weather data for any city in the world — no API key required.

---

## What can you ask it?

Once connected, you can ask your AI client questions like:

- *"What's the weather in Tokyo right now?"*
- *"Give me the 7-day forecast for Buenos Aires."*
- *"Is it raining in London today?"*
- *"What will the weather be like in New York this week?"*

The server understands city names (not coordinates), works globally, and replies in plain, readable language rather than raw numbers.

---

## What is MCP?

**MCP (Model Context Protocol)** is an open standard that lets AI models talk to external tools and data sources in a structured, reliable way. Think of it as a universal plug: you build a server that exposes capabilities (like "fetch weather data"), and any MCP-compatible client — Claude Desktop, Cursor, or your own app — can discover and call those capabilities automatically. Without MCP, every AI integration is a one-off hack; with MCP, you write the tool once and it works everywhere that speaks the protocol.

Want to go deeper? The official "Build an MCP server" guide is the best next read: [modelcontextprotocol.io/docs/develop/build-server](https://modelcontextprotocol.io/docs/develop/build-server)

---

## A note on STDIO transport (and why `console.log()` is forbidden here)

This server uses **STDIO transport**, which means it communicates with its client through the terminal's standard streams:

- **stdin** — the client sends JSON-RPC messages to the server
- **stdout** — the server sends JSON-RPC responses back

Because `stdout` is the protocol's dedicated channel, **you must never write anything else to it**. `console.log()` writes to stdout by default, and even a single stray log line will corrupt the message stream and silently break the server.

`console.error()` is safe because it writes to **stderr**, a completely separate stream that the protocol ignores. That's why every log statement in this codebase uses `console.error()`.

---

## Prerequisites

- **Node.js 16 or higher** — [nodejs.org](https://nodejs.org/)
- **npm** — bundled with Node
- **TypeScript** — installed automatically as a dev dependency when you run `npm install`

No API keys are needed. This server uses the free, open [Open-Meteo](https://open-meteo.com/) API.

---

## Dependencies

These are installed automatically when you run `npm install`.

**Runtime dependencies** — shipped with the server:

| Package | Version | Why it's here |
|---|---|---|
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | `^1.27.1` | The official MCP TypeScript SDK. Provides `McpServer`, `StdioServerTransport`, and the tool registration API. |
| [`zod`](https://zod.dev/) | `^3.25.76` | Schema validation library. Used to define and validate the input each tool accepts (e.g. the `city` string field). The SDK reads these schemas to tell clients what inputs a tool expects. |

**Dev dependencies** — only used during development and compilation:

| Package | Version | Why it's here |
|---|---|---|
| [`typescript`](https://www.typescriptlang.org/) | `^5.9.3` | Compiles `src/index.ts` to plain JavaScript in the `build/` folder. |
| [`@types/node`](https://www.npmjs.com/package/@types/node) | `^25.3.3` | TypeScript type definitions for Node.js built-ins (`process`, `fetch`, etc.). |

---

## Setup and installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd weather

# 2. Install dependencies (includes TypeScript and the MCP SDK)
npm install
```

That's it — no environment variables or config files to set up.

---

## Build and run

**Build** (compiles TypeScript to `build/index.js`):

```bash
npm run build
```

**Run** the server directly:

```bash
node build/index.js
```

You won't see any output in the terminal — the server is waiting silently for a client to connect via stdin. That's normal. Test it with the Inspector below before wiring it up to a client.

---

## Testing with the MCP Inspector

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) is a browser-based tool that lets you call your server's tools interactively before connecting it to Claude or Cursor. It's the fastest way to check that everything works.

```bash
npx @modelcontextprotocol/inspector node /absolute/path/to/weather/build/index.js
```

Replace `/absolute/path/to/weather` with the actual path on your machine (run `pwd` inside the project folder to get it).

The Inspector will open in your browser. You should see two tools listed:

- `get_current_weather`
- `get_weather_forecast`

Click either one, type a city name in the `city` field, and hit **Run tool** to verify the response.

---

## Connecting to Claude Desktop

> **Note:** Claude for Desktop is available on macOS and Windows. Linux users can connect via a custom MCP client instead.

1. Make sure Claude for Desktop is installed and up to date: [claude.ai/download](https://claude.ai/download)

2. Open the Claude Desktop config file in a text editor:

   ```bash
   # macOS
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   Create the file if it doesn't exist.

3. Add the `weather` server under the `mcpServers` key:

   ```json
   {
     "mcpServers": {
       "weather": {
         "command": "node",
         "args": ["/absolute/path/to/weather/build/index.js"]
       }
     }
   }
   ```

   Replace `/absolute/path/to/weather` with the real path (run `pwd` in the project folder).

4. Save the file and **restart Claude for Desktop**.

5. In the Claude chat window, click the **+** icon (Add files, connectors, and more) and hover over "Connectors" — you should see `weather` listed. Now ask Claude anything weather-related and it will automatically call the right tool.

---

## Connecting to Cursor

In Cursor, open **Settings → MCP** (or add directly to your `~/.cursor/mcp.json`) and add:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/weather/build/index.js"]
    }
  }
}
```

Restart Cursor after saving. The weather tools will now be available to the AI in the editor.

---

## How it works

### The two tools

| Tool | What it does |
|---|---|
| `get_current_weather` | Returns the current conditions for a city: temperature, feels-like, humidity, wind speed and direction, precipitation, cloud cover, and pressure. |
| `get_weather_forecast` | Returns a 7-day daily forecast for a city: highs/lows, precipitation probability and total, max wind speed, and UV index for each day. |

Both tools accept a single input: `city` — a plain city name like `"Madrid"`, `"Tokyo"`, or `"New York"`.

### The geocoding step

Weather APIs work with coordinates, not city names. Before fetching any weather data, the server calls the **Open-Meteo Geocoding API** to turn the city name into a latitude/longitude pair. If the city can't be found, the server returns a friendly error message rather than crashing.

### Why natural language instead of raw JSON?

The response from Open-Meteo is a large JSON object full of numbers. Returning that raw data to an LLM would work, but it's wasteful and harder for the model to reason about. Instead, the server formats everything into a human-readable text block — the same format a weather app would show you. The LLM then uses that text to compose its final answer. This keeps responses concise and easy to interpret.

### What happens under the hood when you ask a question

```
You ask: "What's the weather in Lisbon?"
        │
        ▼
Claude decides to call get_current_weather({ city: "Lisbon" })
        │
        ▼
Server geocodes "Lisbon" → lat: 38.716, lon: -9.139
        │
        ▼
Server fetches current conditions from Open-Meteo
        │
        ▼
Server formats the data as readable text and returns it
        │
        ▼
Claude reads the text and replies to you in natural language
```

---

## Project structure

```
weather/
├── src/
│   ├── index.ts           # Server entry point: tool registration, API helpers, and startup
│   └── types/
│       └── weather.ts     # TypeScript interfaces for Open-Meteo API responses
├── build/                 # Compiled JavaScript output (generated by `npm run build`)
├── package.json           # Dependencies, build script, and bin entry
├── tsconfig.json          # TypeScript compiler options (ES2022, Node16 modules, strict)
└── .gitignore
```

**`src/index.ts`** is where everything lives: the `McpServer` instance, the two tool registrations via `server.registerTool()`, the helper functions that call the geocoding and weather APIs, and the `main()` function that wires up the `StdioServerTransport` and starts the server.

**`src/types/weather.ts`** contains typed interfaces for every API response shape. These are used throughout `index.ts` to keep the data handling safe and self-documenting.

---

## Want to extend this?

Here are a few natural next steps if you want to build on top of this server:

**1. Add a new tool — hourly forecast**
The Open-Meteo API supports hourly data. You could add a `get_hourly_forecast` tool that returns temperature and precipitation for the next 24 hours, following the same pattern as the existing tools in `server.registerTool()`.

**2. Expose weather data as an MCP Resource**
MCP supports [Resources](https://modelcontextprotocol.io/docs/learn/server-concepts#resources) — file-like data that clients can read on demand. You could expose the raw forecast JSON as a resource (e.g. `weather://tokyo/forecast`) so clients that prefer structured data can access it directly alongside the natural-language tools.

**3. Connect to a different weather provider**
The server's architecture cleanly separates geocoding, data fetching, and formatting into small helper functions. Swapping Open-Meteo for another API (OpenWeatherMap, WeatherAPI, etc.) only requires changing the fetch helpers and type interfaces — the MCP layer stays untouched.
