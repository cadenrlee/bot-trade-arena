"""
Bot Trade Arena — Alpaca Connector

One script connects everything:
  1. Connects to your Alpaca account for live market data
  2. Connects to Bot Trade Arena for match participation
  3. Runs your strategy using real Alpaca prices
  4. No extra setup needed

SETUP:
  pip install websocket-client alpaca-py

USAGE:
  python alpaca_connector.py

  Or import and use programmatically:

    from alpaca_connector import AlpacaArenaBot

    bot = AlpacaArenaBot(
        alpaca_key="your-alpaca-key",
        alpaca_secret="your-alpaca-secret",
        arena_api_key="your-bot-api-key",
    )

    @bot.on_tick
    def strategy(tick, state):
        if tick["price"] > state["avg_price"] * 1.001:
            bot.buy(tick["symbol"], 0.1)

    bot.run()
"""

import json
import time
import os
import sys
import threading
from typing import Callable, Optional, Dict, List, Any
from dataclasses import dataclass, field

try:
    import websocket
except ImportError:
    print("Install: pip install websocket-client")
    sys.exit(1)

# ============================================================
# CONFIG — Set these or use environment variables
# ============================================================

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_API_SECRET = os.environ.get("ALPACA_API_SECRET", "")
ALPACA_WS_URL = os.environ.get("ALPACA_WS_URL", "wss://stream.data.alpaca.markets/v1beta3/crypto/us")
ALPACA_PAPER = True  # Set False for live trading data

ARENA_API_KEY = os.environ.get("BTA_API_KEY", "")
ARENA_WS_URL = os.environ.get("BTA_WS_URL", "ws://localhost:8080/bot-ws")

# Symbol mapping: Arena format → Alpaca format
SYMBOL_MAP = {
    "BTCUSDT": "BTC/USD",
    "ETHUSDT": "ETH/USD",
    "SOLUSDT": "SOL/USD",
    "BNBUSDT": "BNB/USD",
    "XRPUSDT": "XRP/USD",
    "DOGEUSDT": "DOGE/USD",
}
REVERSE_MAP = {v: k for k, v in SYMBOL_MAP.items()}


# ============================================================
# STATE TRACKING
# ============================================================

@dataclass
class BotState:
    cash: float = 100000.0
    pnl: float = 0.0
    positions: list = field(default_factory=list)
    trades: int = 0
    wins: int = 0
    losses: int = 0
    prices: Dict[str, float] = field(default_factory=dict)
    price_history: Dict[str, List[float]] = field(default_factory=dict)
    in_match: bool = False
    match_id: str = ""
    symbols: List[str] = field(default_factory=list)

    @property
    def avg_price(self) -> Dict[str, float]:
        """Get average price for each symbol over recent history"""
        avgs = {}
        for sym, prices in self.price_history.items():
            if prices:
                avgs[sym] = sum(prices[-20:]) / min(len(prices), 20)
        return avgs

    @property
    def win_rate(self) -> float:
        return (self.wins / self.trades * 100) if self.trades > 0 else 0.0


# ============================================================
# MAIN CONNECTOR
# ============================================================

class AlpacaArenaBot:
    """
    Bridges Alpaca market data with Bot Trade Arena matches.

    Usage:
        bot = AlpacaArenaBot(
            alpaca_key="...",
            alpaca_secret="...",
            arena_api_key="...",
        )

        @bot.on_tick
        def my_strategy(tick, state):
            # tick = {"symbol": "BTCUSDT", "price": 67432.50, "volume": 1.2}
            # state = BotState with cash, pnl, positions, prices, etc.
            if some_condition:
                bot.buy(tick["symbol"], quantity=0.5)

        bot.run()
    """

    def __init__(
        self,
        alpaca_key: str = "",
        alpaca_secret: str = "",
        arena_api_key: str = "",
        arena_url: str = "",
        alpaca_url: str = "",
        symbols: Optional[List[str]] = None,
    ):
        self.alpaca_key = alpaca_key or ALPACA_API_KEY
        self.alpaca_secret = alpaca_secret or ALPACA_API_SECRET
        self.arena_key = arena_api_key or ARENA_API_KEY
        self.arena_url = arena_url or ARENA_WS_URL
        self.alpaca_url = alpaca_url or ALPACA_WS_URL
        self.symbols = symbols or list(SYMBOL_MAP.keys())

        self.state = BotState()
        self.arena_ws: Optional[websocket.WebSocketApp] = None
        self.alpaca_ws: Optional[websocket.WebSocketApp] = None
        self._arena_connected = False
        self._alpaca_connected = False
        self._authenticated = False

        # User callbacks
        self._on_tick: Optional[Callable] = None
        self._on_match_start: Optional[Callable] = None
        self._on_match_end: Optional[Callable] = None
        self._on_order: Optional[Callable] = None

        self._validate_config()

    def _validate_config(self):
        errors = []
        if not self.alpaca_key:
            errors.append("ALPACA_API_KEY not set (env var or constructor)")
        if not self.alpaca_secret:
            errors.append("ALPACA_API_SECRET not set (env var or constructor)")
        if not self.arena_key:
            errors.append("BTA_API_KEY not set (env var or constructor)")
        if errors:
            print("\n⚠️  Configuration needed:")
            for e in errors:
                print(f"   • {e}")
            print("\n  Set environment variables or pass to constructor.")
            print("  Get Alpaca keys at: https://alpaca.markets")
            print("  Get Arena bot key at: http://localhost:3000/bots")
            print()

    # ============================================================
    # DECORATORS — register your strategy
    # ============================================================

    def on_tick(self, func: Callable) -> Callable:
        """Register your strategy function. Called on every price update.

        Your function receives:
          tick: {"symbol": "BTCUSDT", "price": 67432.50, "volume": 1.2}
          state: BotState with cash, pnl, positions, prices, price_history, etc.
        """
        self._on_tick = func
        return func

    def on_match_start(self, func: Callable) -> Callable:
        """Called when a match begins."""
        self._on_match_start = func
        return func

    def on_match_end(self, func: Callable) -> Callable:
        """Called when a match ends with results."""
        self._on_match_end = func
        return func

    def on_order(self, func: Callable) -> Callable:
        """Called when an order result comes back."""
        self._on_order = func
        return func

    # ============================================================
    # TRADING ACTIONS — call these from your strategy
    # ============================================================

    def buy(self, symbol: str, quantity: float):
        """Open a LONG position."""
        self._send_arena({
            "type": "order",
            "data": {"symbol": symbol, "side": "LONG", "action": "OPEN", "quantity": quantity}
        })

    def sell(self, symbol: str, quantity: float):
        """Open a SHORT position."""
        self._send_arena({
            "type": "order",
            "data": {"symbol": symbol, "side": "SHORT", "action": "OPEN", "quantity": quantity}
        })

    def close(self, position_id: str):
        """Close a position by ID."""
        pos = next((p for p in self.state.positions if p.get("id") == position_id), None)
        if not pos:
            print(f"[Arena] Position {position_id} not found")
            return
        self._send_arena({
            "type": "order",
            "data": {
                "symbol": pos["symbol"],
                "side": pos["side"],
                "action": "CLOSE",
                "quantity": pos["quantity"],
                "positionId": position_id,
            }
        })

    def close_all(self):
        """Close all open positions."""
        for pos in list(self.state.positions):
            self.close(pos.get("id", ""))

    def close_symbol(self, symbol: str):
        """Close all positions for a specific symbol."""
        for pos in list(self.state.positions):
            if pos.get("symbol") == symbol:
                self.close(pos.get("id", ""))

    def get_position(self, symbol: str) -> Optional[dict]:
        """Get open position for a symbol, if any."""
        return next((p for p in self.state.positions if p.get("symbol") == symbol), None)

    def queue_for_match(self):
        """Join the matchmaking queue."""
        self._send_arena({"type": "queue", "mode": "LIVE"})
        print("[Arena] Queued for match — waiting for opponent...")

    # ============================================================
    # RUN — starts everything
    # ============================================================

    def run(self, auto_queue: bool = True):
        """
        Start the bot. Connects to both Alpaca and Arena.
        Set auto_queue=True to automatically join matchmaking.
        """
        print()
        print("=" * 55)
        print("  Bot Trade Arena — Alpaca Connector")
        print("=" * 55)
        print(f"  Alpaca:  {'✓ Keys set' if self.alpaca_key else '✗ No keys'}")
        print(f"  Arena:   {self.arena_url}")
        print(f"  Symbols: {', '.join(self.symbols[:3])}{'...' if len(self.symbols) > 3 else ''}")
        print("=" * 55)
        print()

        # Start Alpaca in background thread
        alpaca_thread = threading.Thread(target=self._run_alpaca, daemon=True)
        alpaca_thread.start()

        # Small delay for Alpaca to connect first
        time.sleep(1)

        # Start Arena connection (blocks)
        self._run_arena(auto_queue)

    # ============================================================
    # ALPACA WebSocket
    # ============================================================

    def _run_alpaca(self):
        if not self.alpaca_key:
            print("[Alpaca] Skipping — no API keys. Arena will provide market data.")
            return

        self.alpaca_ws = websocket.WebSocketApp(
            self.alpaca_url,
            on_open=self._alpaca_on_open,
            on_message=self._alpaca_on_message,
            on_error=self._alpaca_on_error,
            on_close=self._alpaca_on_close,
        )
        self.alpaca_ws.run_forever(ping_interval=30)

    def _alpaca_on_open(self, ws):
        # Authenticate
        ws.send(json.dumps({
            "action": "auth",
            "key": self.alpaca_key,
            "secret": self.alpaca_secret,
        }))

    def _alpaca_on_message(self, ws, message):
        try:
            msgs = json.loads(message)
            for msg in (msgs if isinstance(msgs, list) else [msgs]):
                if msg.get("T") == "success" and msg.get("msg") == "authenticated":
                    self._alpaca_connected = True
                    # Subscribe to crypto trades
                    alpaca_symbols = [SYMBOL_MAP.get(s, s) for s in self.symbols]
                    ws.send(json.dumps({
                        "action": "subscribe",
                        "trades": alpaca_symbols,
                    }))
                    print(f"[Alpaca] ✓ Connected — subscribed to {', '.join(alpaca_symbols)}")

                elif msg.get("T") == "t":
                    # Trade data — forward to Arena format
                    alpaca_sym = msg.get("S", "")
                    arena_sym = REVERSE_MAP.get(alpaca_sym, alpaca_sym)
                    price = msg.get("p", 0)

                    self.state.prices[arena_sym] = price
                    if arena_sym not in self.state.price_history:
                        self.state.price_history[arena_sym] = []
                    self.state.price_history[arena_sym].append(price)
                    # Keep last 100
                    if len(self.state.price_history[arena_sym]) > 100:
                        self.state.price_history[arena_sym] = self.state.price_history[arena_sym][-100:]

                elif msg.get("T") == "error":
                    print(f"[Alpaca] Error: {msg.get('msg', 'Unknown')}")

        except Exception as e:
            pass  # Ignore parse errors

    def _alpaca_on_error(self, ws, error):
        print(f"[Alpaca] Error: {error}")

    def _alpaca_on_close(self, ws, code, reason):
        self._alpaca_connected = False
        print(f"[Alpaca] Disconnected ({code}). Reconnecting in 5s...")
        time.sleep(5)
        self._run_alpaca()

    # ============================================================
    # ARENA WebSocket
    # ============================================================

    def _run_arena(self, auto_queue: bool):
        self.arena_ws = websocket.WebSocketApp(
            self.arena_url,
            on_open=lambda ws: self._arena_on_open(ws, auto_queue),
            on_message=self._arena_on_message,
            on_error=self._arena_on_error,
            on_close=self._arena_on_close,
        )
        self.arena_ws.run_forever(ping_interval=30, ping_timeout=10)

    def _arena_on_open(self, ws, auto_queue: bool):
        self._arena_connected = True
        # Authenticate with bot API key
        ws.send(json.dumps({"type": "auth", "apiKey": self.arena_key}))
        print("[Arena] ✓ Connected — authenticating...")

        if auto_queue:
            # Wait briefly for auth, then queue
            def delayed_queue():
                time.sleep(1)
                self.queue_for_match()
            threading.Thread(target=delayed_queue, daemon=True).start()

    def _arena_on_message(self, ws, message):
        try:
            msg = json.loads(message)
        except:
            return

        msg_type = msg.get("type", "")
        data = msg.get("data", {})

        if msg_type == "auth:success":
            self._authenticated = True
            print(f"[Arena] ✓ Authenticated as bot: {data.get('name', '?')} (ELO: {data.get('elo', '?')})")

        elif msg_type == "queue:joined":
            print(f"[Arena] {data.get('message', 'In queue...')}")

        elif msg_type == "match:start":
            self.state.in_match = True
            self.state.match_id = data.get("matchId", "")
            self.state.symbols = data.get("symbols", [])
            self.state.cash = data.get("capital", 100000)
            self.state.pnl = 0
            self.state.trades = 0
            self.state.wins = 0
            self.state.losses = 0
            self.state.positions = []
            print(f"\n{'='*50}")
            print(f"  MATCH STARTED!")
            print(f"  Opponent: {data.get('opponent', 'Unknown')}")
            print(f"  Duration: {data.get('duration', 300)}s")
            print(f"  Symbols:  {', '.join(self.state.symbols)}")
            print(f"  Capital:  ${self.state.cash:,.0f}")
            print(f"{'='*50}\n")
            if self._on_match_start:
                self._on_match_start(data)

        elif msg_type == "market:tick":
            # Update state with arena prices
            sym = data.get("symbol", "")
            price = data.get("price", 0)
            self.state.prices[sym] = price
            if sym not in self.state.price_history:
                self.state.price_history[sym] = []
            self.state.price_history[sym].append(price)
            if len(self.state.price_history[sym]) > 100:
                self.state.price_history[sym] = self.state.price_history[sym][-100:]

            tick = {"symbol": sym, "price": price, "volume": data.get("volume", 0)}
            if self._on_tick:
                self._on_tick(tick, self.state)

        elif msg_type == "state:update":
            self.state.cash = data.get("cash", self.state.cash)
            self.state.pnl = data.get("pnl", self.state.pnl)
            self.state.trades = data.get("trades", self.state.trades)
            self.state.wins = data.get("wins", self.state.wins)
            self.state.losses = data.get("losses", self.state.losses)
            if "positions" in data:
                self.state.positions = data["positions"]

        elif msg_type == "order:result":
            success = data.get("success", False)
            if not success:
                err = data.get("error", "Unknown error")
                if "Must wait" not in err:  # Don't spam rate limit messages
                    print(f"[Arena] Order rejected: {err}")
            if self._on_order:
                self._on_order(data)

        elif msg_type == "match:end":
            self.state.in_match = False
            winner = data.get("winner", "")
            score = data.get("score", {})
            elo_change = data.get("eloChange", 0)
            print(f"\n{'='*50}")
            print(f"  MATCH ENDED!")
            print(f"  Score: {score.get('compositeScore', '?')}")
            print(f"  P&L:   ${self.state.pnl:+,.2f}")
            print(f"  ELO:   {elo_change:+d}")
            print(f"  Trades: {self.state.trades} ({self.state.wins}W/{self.state.losses}L)")
            print(f"{'='*50}\n")
            if self._on_match_end:
                self._on_match_end(data)

            # Auto re-queue
            time.sleep(2)
            print("[Arena] Re-queuing for next match...")
            self.queue_for_match()

        elif msg_type == "error":
            print(f"[Arena] Error: {data.get('message', 'Unknown')}")

    def _arena_on_error(self, ws, error):
        print(f"[Arena] Error: {error}")

    def _arena_on_close(self, ws, code, reason):
        self._arena_connected = False
        self._authenticated = False
        print(f"[Arena] Disconnected. Reconnecting in 5s...")
        time.sleep(5)
        self._run_arena(auto_queue=True)

    def _send_arena(self, msg: dict):
        if self.arena_ws:
            try:
                self.arena_ws.send(json.dumps(msg))
            except:
                pass


# ============================================================
# EXAMPLE STRATEGIES
# ============================================================

def simple_momentum(lookback: int = 15, threshold: float = 0.15, size: float = 0.1):
    """Pre-built momentum strategy. Buy trending up, sell trending down."""
    def strategy(tick, state):
        sym = tick["symbol"]
        price = tick["price"]
        history = state.price_history.get(sym, [])
        if len(history) < lookback:
            return

        old = history[-lookback]
        change = ((price - old) / old) * 100

        existing = next((p for p in state.positions if p.get("symbol") == sym), None)

        if change > threshold and not existing and state.cash > price * size:
            bot.buy(sym, size)
        elif change < -threshold and existing and existing.get("side") == "LONG":
            bot.close(existing["id"])

    return strategy


def mean_reversion(window: int = 20, z_threshold: float = 1.5, size: float = 0.08):
    """Pre-built mean reversion. Buy dips, sell rallies."""
    def strategy(tick, state):
        sym = tick["symbol"]
        price = tick["price"]
        history = state.price_history.get(sym, [])
        if len(history) < window:
            return

        prices = history[-window:]
        mean = sum(prices) / len(prices)
        variance = sum((p - mean) ** 2 for p in prices) / len(prices)
        std = variance ** 0.5
        if std == 0:
            return

        z = (price - mean) / std
        existing = next((p for p in state.positions if p.get("symbol") == sym), None)

        if z < -z_threshold and not existing and state.cash > price * size:
            bot.buy(sym, size)
        elif z > z_threshold and not existing and state.cash > price * size:
            bot.sell(sym, size)
        elif existing and abs(z) < 0.3:
            bot.close(existing["id"])

    return strategy


# ============================================================
# CLI ENTRY POINT
# ============================================================

if __name__ == "__main__":
    print()
    print("=" * 55)
    print("  Bot Trade Arena — Alpaca Connector")
    print("=" * 55)
    print()

    # Check for keys
    alpaca_key = os.environ.get("ALPACA_API_KEY", "")
    alpaca_secret = os.environ.get("ALPACA_API_SECRET", "")
    arena_key = os.environ.get("BTA_API_KEY", "")

    if not arena_key:
        print("  Set your bot's API key:")
        print("    export BTA_API_KEY=your-bot-api-key")
        print()
        print("  Get it from: http://localhost:3000/bots")
        print()
        arena_key = input("  Or paste it here: ").strip()

    if not alpaca_key:
        print()
        print("  Alpaca keys (optional — Arena has its own market data):")
        print("    export ALPACA_API_KEY=your-key")
        print("    export ALPACA_API_SECRET=your-secret")
        print()
        print("  Get free keys at: https://alpaca.markets")
        print()
        use_alpaca = input("  Do you have Alpaca keys? (y/n): ").strip().lower()
        if use_alpaca == "y":
            alpaca_key = input("  Alpaca API Key: ").strip()
            alpaca_secret = input("  Alpaca Secret:  ").strip()

    # Pick strategy
    print()
    print("  Available strategies:")
    print("    1. Momentum (follow trends)")
    print("    2. Mean Reversion (buy dips)")
    print("    3. Custom (write your own)")
    print()
    choice = input("  Pick a strategy (1/2/3): ").strip()

    bot = AlpacaArenaBot(
        alpaca_key=alpaca_key,
        alpaca_secret=alpaca_secret,
        arena_api_key=arena_key,
    )

    if choice == "1":
        bot.on_tick(simple_momentum())
        print("\n  Using: Momentum strategy (lookback=15, threshold=0.15%)")
    elif choice == "2":
        bot.on_tick(mean_reversion())
        print("\n  Using: Mean Reversion strategy (window=20, z=1.5)")
    else:
        @bot.on_tick
        def custom_strategy(tick, state):
            # YOUR STRATEGY HERE
            # tick = {"symbol": "BTCUSDT", "price": 67432.50, "volume": 1.2}
            # state.cash, state.pnl, state.positions, state.prices, state.price_history
            # bot.buy(symbol, quantity), bot.sell(symbol, quantity), bot.close(position_id)
            pass
        print("\n  Using: Custom strategy (edit the script to add your logic)")

    print()
    bot.run()
