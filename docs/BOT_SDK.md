# Bot SDK Guide

## Quick start (Python)

```bash
pip install websocket-client
```

```python
from bot_trade_arena import BotClient

client = BotClient(api_key="your-api-key-here")

@client.on_market_tick
def on_tick(tick):
    symbol = tick["symbol"]   # "BTCUSDT"
    price = tick["price"]     # 67432.50
    volume = tick["volume"]   # 1.234

    # Your strategy logic
    if price > some_threshold:
        client.open_position(symbol, "LONG", quantity=0.01)

client.connect()
client.queue_for_match()
client.run_forever()
```

## How matches work

1. Your bot connects via WebSocket and authenticates with its API key
2. You call `queue_for_match()` to enter the matchmaking queue
3. When matched, you receive a `match:start` event with match details
4. Market data ticks stream in — your bot decides when to trade
5. After the match duration, all positions are force-closed
6. Composite scores are calculated and the winner is determined

## Available actions

| Method | Description |
|--------|-------------|
| `client.open_position(symbol, side, quantity)` | Open a LONG or SHORT position |
| `client.close_position(position_id)` | Close a specific position |
| `client.close_all()` | Close all open positions |
| `client.get_price(symbol)` | Get latest price |
| `client.get_position(symbol)` | Get your open position for a symbol |
| `client.state` | Access current cash, P&L, positions, win/loss |

## Events your bot receives

| Event | Data | When |
|-------|------|------|
| `match:start` | matchId, opponent, symbols, duration, capital | Match begins |
| `market:tick` | symbol, price, volume, timestamp | Every second per symbol |
| `order:result` | success, tradeId, error | After every order |
| `state:update` | cash, positions, pnl, trades, wins, losses | After every trade |
| `match:end` | winner, score, eloChange | Match ends |

## Rules & limits

- **Starting capital**: $100,000 (virtual)
- **Max open positions**: 5 simultaneously
- **Max position size**: 30% of total capital per position
- **Min trade interval**: 3 seconds between trades
- **Min trades**: 5 per match (or you get a scoring penalty)
- **Fees**: 0.1% simulated trading fee per trade

## Starter bots included

Three ready-to-run bots are included in the SDK:

1. **Momentum Bot** — Follows price trends, buys breakouts, sells breakdowns
2. **Mean Reversion Bot** — Buys when price drops below average, sells when above
3. **Random Bot** — Makes random trades. Use as a baseline to beat.

```python
from bot_trade_arena import create_momentum_bot

bot = create_momentum_bot(api_key="your-key", lookback=20, threshold=0.5)
bot.connect()
bot.queue_for_match()
bot.run_forever()
```

## Building your own bot

Use any language that supports WebSocket connections. The protocol is JSON over WebSocket:

**Connect**: `ws://server:8080/bot-ws`

**Authenticate**:
```json
{"type": "auth", "apiKey": "your-api-key"}
```

**Place an order**:
```json
{
  "type": "order",
  "data": {
    "symbol": "BTCUSDT",
    "side": "LONG",
    "action": "OPEN",
    "quantity": 0.5
  }
}
```

**Close a position**:
```json
{
  "type": "order",
  "data": {
    "symbol": "BTCUSDT",
    "side": "LONG",
    "action": "CLOSE",
    "quantity": 0.5,
    "positionId": "pos_123"
  }
}
```

You'll receive results for every order:
```json
{
  "type": "order:result",
  "data": {
    "success": true,
    "tradeId": "pos_123"
  }
}
```

## Tips for competitive bots

1. **Beat the random bot first** — If you can't beat random, rethink your approach
2. **Focus on risk management** — The scoring system heavily rewards low drawdowns
3. **Don't overtrade** — Fees eat into profits on high-frequency strategies
4. **Use the sandbox** — Test your bot against historical data before entering ranked
5. **Watch replays** — Study what winning bots do differently
6. **Diversify** — Trading multiple symbols reduces concentration risk
