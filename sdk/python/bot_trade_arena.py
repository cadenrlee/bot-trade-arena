"""
Bot Trade Arena — Python SDK

Install: pip install bot-trade-arena
Usage:

    from bot_trade_arena import BotClient, TradeSignal

    client = BotClient(api_key="your-api-key")

    @client.on_match_start
    def on_start(match_info):
        print(f"Match started! Opponent: {match_info['opponent']}")

    @client.on_market_tick
    def on_tick(tick):
        # Your strategy logic here
        if should_buy(tick):
            client.open_position(symbol=tick['symbol'], side='LONG', quantity=10)

    @client.on_match_end
    def on_end(result):
        print(f"Match ended! Score: {result['score']}")

    client.connect()
    client.queue_for_match()
    client.run_forever()
"""

import json
import time
import threading
from typing import Callable, Optional, Dict, Any, List
from dataclasses import dataclass, field
try:
    import websocket
except ImportError:
    print("Install websocket-client: pip install websocket-client")
    raise


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class Position:
    id: str
    symbol: str
    side: str  # 'LONG' or 'SHORT'
    entry_price: float
    quantity: float
    entry_time: float

@dataclass
class BotState:
    cash: float = 100000.0
    pnl: float = 0.0
    positions: List[Position] = field(default_factory=list)
    trades: int = 0
    wins: int = 0
    losses: int = 0

    @property
    def win_rate(self) -> float:
        if self.trades == 0:
            return 0.0
        return (self.wins / self.trades) * 100

    @property
    def open_positions(self) -> int:
        return len(self.positions)


# ============================================================
# BOT CLIENT
# ============================================================

class BotClient:
    """Main client for connecting to Bot Trade Arena."""

    def __init__(self, api_key: str, server_url: str = "ws://localhost:8080/bot-ws"):
        self.api_key = api_key
        self.server_url = server_url
        self.ws: Optional[websocket.WebSocketApp] = None
        self.state = BotState()
        self.match_id: Optional[str] = None
        self.is_in_match = False
        self.prices: Dict[str, float] = {}

        # Event handlers
        self._on_match_start: Optional[Callable] = None
        self._on_market_tick: Optional[Callable] = None
        self._on_match_end: Optional[Callable] = None
        self._on_order_result: Optional[Callable] = None
        self._on_state_update: Optional[Callable] = None
        self._on_error: Optional[Callable] = None

    # ============================================================
    # EVENT DECORATORS
    # ============================================================

    def on_match_start(self, func: Callable) -> Callable:
        """Register handler for match start."""
        self._on_match_start = func
        return func

    def on_market_tick(self, func: Callable) -> Callable:
        """Register handler for market data ticks."""
        self._on_market_tick = func
        return func

    def on_match_end(self, func: Callable) -> Callable:
        """Register handler for match end."""
        self._on_match_end = func
        return func

    def on_order_result(self, func: Callable) -> Callable:
        """Register handler for order execution results."""
        self._on_order_result = func
        return func

    def on_state_update(self, func: Callable) -> Callable:
        """Register handler for state updates."""
        self._on_state_update = func
        return func

    def on_error(self, func: Callable) -> Callable:
        """Register error handler."""
        self._on_error = func
        return func

    # ============================================================
    # TRADING ACTIONS
    # ============================================================

    def open_position(self, symbol: str, side: str, quantity: float) -> None:
        """Open a new position."""
        self._send({
            "type": "order",
            "data": {
                "symbol": symbol,
                "side": side.upper(),
                "action": "OPEN",
                "quantity": quantity,
            }
        })

    def close_position(self, position_id: str) -> None:
        """Close an existing position by ID."""
        pos = next((p for p in self.state.positions if p.id == position_id), None)
        if not pos:
            print(f"Warning: Position {position_id} not found locally")
            return

        self._send({
            "type": "order",
            "data": {
                "symbol": pos.symbol,
                "side": pos.side,
                "action": "CLOSE",
                "quantity": pos.quantity,
                "positionId": position_id,
            }
        })

    def close_all(self) -> None:
        """Close all open positions."""
        for pos in list(self.state.positions):
            self.close_position(pos.id)

    def get_price(self, symbol: str) -> Optional[float]:
        """Get the latest price for a symbol."""
        return self.prices.get(symbol)

    def get_position(self, symbol: str) -> Optional[Position]:
        """Get open position for a symbol, if any."""
        return next((p for p in self.state.positions if p.symbol == symbol), None)

    # ============================================================
    # CONNECTION
    # ============================================================

    def connect(self) -> None:
        """Connect to the Bot Trade Arena server."""
        self.ws = websocket.WebSocketApp(
            self.server_url,
            on_open=self._handle_open,
            on_message=self._handle_message,
            on_error=self._handle_error,
            on_close=self._handle_close,
        )

    def queue_for_match(self, mode: str = "LIVE") -> None:
        """Queue for a matchmaking match."""
        self._send({"type": "queue", "mode": mode})

    def run_forever(self) -> None:
        """Start the event loop. Blocks until disconnected."""
        if not self.ws:
            raise RuntimeError("Call connect() first")
        self.ws.run_forever(ping_interval=30, ping_timeout=10)

    def run_async(self) -> threading.Thread:
        """Start the event loop in a background thread."""
        t = threading.Thread(target=self.run_forever, daemon=True)
        t.start()
        return t

    # ============================================================
    # INTERNAL HANDLERS
    # ============================================================

    def _send(self, data: dict) -> None:
        if self.ws:
            self.ws.send(json.dumps(data))

    def _handle_open(self, ws):
        # Authenticate
        self._send({"type": "auth", "apiKey": self.api_key})
        print("[BTA] Connected to Bot Trade Arena")

    def _handle_message(self, ws, message: str):
        try:
            msg = json.loads(message)
        except json.JSONDecodeError:
            return

        msg_type = msg.get("type", "")
        data = msg.get("data", {})

        if msg_type == "match:start":
            self.is_in_match = True
            self.match_id = data.get("matchId")
            self.state = BotState(cash=data.get("capital", 100000))
            if self._on_match_start:
                self._on_match_start(data)

        elif msg_type == "market:tick":
            self.prices[data["symbol"]] = data["price"]
            if self._on_market_tick:
                self._on_market_tick(data)

        elif msg_type == "order:result":
            if self._on_order_result:
                self._on_order_result(data)

        elif msg_type == "state:update":
            self._update_state(data)
            if self._on_state_update:
                self._on_state_update(data)

        elif msg_type == "match:end":
            self.is_in_match = False
            if self._on_match_end:
                self._on_match_end(data)

        elif msg_type == "error":
            if self._on_error:
                self._on_error(data)

    def _handle_error(self, ws, error):
        print(f"[BTA] Error: {error}")
        if self._on_error:
            self._on_error({"message": str(error)})

    def _handle_close(self, ws, code, reason):
        print(f"[BTA] Disconnected: {code} {reason}")

    def _update_state(self, data: dict):
        self.state.cash = data.get("cash", self.state.cash)
        self.state.pnl = data.get("pnl", self.state.pnl)
        self.state.trades = data.get("trades", self.state.trades)
        self.state.wins = data.get("wins", self.state.wins)
        self.state.losses = data.get("losses", self.state.losses)
        if "positions" in data:
            self.state.positions = [
                Position(
                    id=p["id"],
                    symbol=p["symbol"],
                    side=p["side"],
                    entry_price=p["entryPrice"],
                    quantity=p["quantity"],
                    entry_time=p["entryTime"],
                )
                for p in data["positions"]
            ]


# ============================================================
# STARTER BOT: MOMENTUM
# ============================================================

def create_momentum_bot(api_key: str, lookback: int = 20, threshold: float = 0.5):
    """
    Starter Bot #1: Simple Momentum
    Buys when price increases by threshold% over lookback ticks.
    Sells when it drops by threshold%.
    """
    client = BotClient(api_key=api_key)
    price_history: Dict[str, List[float]] = {}

    @client.on_match_start
    def on_start(info):
        price_history.clear()
        print(f"[Momentum Bot] Match started vs {info.get('opponent', 'unknown')}")

    @client.on_market_tick
    def on_tick(tick):
        symbol = tick["symbol"]
        price = tick["price"]

        if symbol not in price_history:
            price_history[symbol] = []
        price_history[symbol].append(price)

        # Need enough history
        if len(price_history[symbol]) < lookback:
            return

        # Keep only recent history
        price_history[symbol] = price_history[symbol][-lookback:]

        # Calculate momentum
        old_price = price_history[symbol][0]
        change_pct = ((price - old_price) / old_price) * 100

        existing = client.get_position(symbol)

        if change_pct > threshold and not existing:
            # Price going up — buy
            qty = min(10, client.state.cash / price * 0.2)
            if qty > 0 and client.state.cash > price * qty:
                client.open_position(symbol, "LONG", round(qty, 4))

        elif change_pct < -threshold and existing and existing.side == "LONG":
            # Price reversing — close long
            client.close_position(existing.id)

        elif change_pct < -threshold and not existing:
            # Price going down — short
            qty = min(10, client.state.cash / price * 0.2)
            if qty > 0:
                client.open_position(symbol, "SHORT", round(qty, 4))

        elif change_pct > threshold and existing and existing.side == "SHORT":
            # Price reversing up — close short
            client.close_position(existing.id)

    @client.on_match_end
    def on_end(result):
        print(f"[Momentum Bot] Match ended. Score: {result.get('score', 'N/A')}")

    return client


# ============================================================
# STARTER BOT: MEAN REVERSION
# ============================================================

def create_mean_reversion_bot(api_key: str, window: int = 30, z_threshold: float = 1.5):
    """
    Starter Bot #2: Mean Reversion
    Buys when price drops below mean - z*stddev.
    Sells when price rises above mean + z*stddev.
    """
    client = BotClient(api_key=api_key)
    price_history: Dict[str, List[float]] = {}

    @client.on_match_start
    def on_start(info):
        price_history.clear()
        print(f"[Mean Reversion Bot] Match started")

    @client.on_market_tick
    def on_tick(tick):
        symbol = tick["symbol"]
        price = tick["price"]

        if symbol not in price_history:
            price_history[symbol] = []
        price_history[symbol].append(price)

        if len(price_history[symbol]) < window:
            return

        price_history[symbol] = price_history[symbol][-window:]
        prices = price_history[symbol]

        mean = sum(prices) / len(prices)
        variance = sum((p - mean) ** 2 for p in prices) / len(prices)
        std = variance ** 0.5

        if std == 0:
            return

        z_score = (price - mean) / std
        existing = client.get_position(symbol)

        if z_score < -z_threshold and not existing:
            # Price below mean — buy (expect reversion up)
            qty = min(10, client.state.cash / price * 0.15)
            if qty > 0 and client.state.cash > price * qty:
                client.open_position(symbol, "LONG", round(qty, 4))

        elif z_score > z_threshold and not existing:
            # Price above mean — short (expect reversion down)
            qty = min(10, client.state.cash / price * 0.15)
            if qty > 0:
                client.open_position(symbol, "SHORT", round(qty, 4))

        elif existing:
            # Close if price reverted to mean
            if abs(z_score) < 0.3:
                client.close_position(existing.id)

    @client.on_match_end
    def on_end(result):
        print(f"[Mean Reversion Bot] Match ended. Score: {result.get('score', 'N/A')}")

    return client


# ============================================================
# STARTER BOT: RANDOM BASELINE
# ============================================================

def create_random_bot(api_key: str, trade_probability: float = 0.05):
    """
    Starter Bot #3: Random Baseline
    Makes random trades. Use this as a baseline to beat.
    If you can't beat the random bot, your strategy needs work.
    """
    import random
    client = BotClient(api_key=api_key)

    @client.on_match_start
    def on_start(info):
        print(f"[Random Bot] Match started")

    @client.on_market_tick
    def on_tick(tick):
        if random.random() > trade_probability:
            return

        symbol = tick["symbol"]
        price = tick["price"]
        existing = client.get_position(symbol)

        if existing:
            # 50% chance to close
            if random.random() > 0.5:
                client.close_position(existing.id)
        else:
            # Open random position
            side = "LONG" if random.random() > 0.5 else "SHORT"
            qty = round(client.state.cash / price * random.uniform(0.05, 0.15), 4)
            if qty > 0 and client.state.cash > price * qty:
                client.open_position(symbol, side, qty)

    @client.on_match_end
    def on_end(result):
        print(f"[Random Bot] Match ended. Score: {result.get('score', 'N/A')}")

    return client


# ============================================================
# CLI ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import sys

    print("=" * 50)
    print("  Bot Trade Arena — Python SDK")
    print("=" * 50)
    print()
    print("Starter bots available:")
    print("  1. Momentum Bot    — Trend following")
    print("  2. Mean Reversion  — Buy dips, sell rallies")
    print("  3. Random Baseline — Beat this to prove your strategy works")
    print()
    print("Quick start:")
    print('  from bot_trade_arena import BotClient')
    print('  client = BotClient(api_key="your-key")')
    print('  # ... register handlers ...')
    print('  client.connect()')
    print('  client.queue_for_match()')
    print('  client.run_forever()')
