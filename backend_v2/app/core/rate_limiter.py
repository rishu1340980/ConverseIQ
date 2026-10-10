from datetime import datetime, timezone
from collections import defaultdict
import threading

class InMemoryIPRateLimiter:
    """
    Thread-safe sliding-window rate limiter for client IP addresses.
    Configurable request count within a sliding observation window.
    Designed for single-instance or worker protection; in distributed multi-region
    clusters, configure Redis-backed limiter storage.
    """
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.records: dict[str, list[float]] = defaultdict(list)
        self.lock = threading.Lock()

    def is_rate_limited(self, ip: str) -> bool:
        if not ip:
            return False
        now = datetime.now(timezone.utc).timestamp()
        cutoff = now - self.window_seconds

        with self.lock:
            # Purge timestamps outside the sliding window
            valid_timestamps = [t for t in self.records[ip] if t > cutoff]
            if len(valid_timestamps) >= self.max_requests:
                self.records[ip] = valid_timestamps
                return True
            valid_timestamps.append(now)
            self.records[ip] = valid_timestamps
            return False

    def reset_ip(self, ip: str):
        with self.lock:
            if ip in self.records:
                del self.records[ip]

# Singleton login rate limiter: 5 attempts per 60 seconds per IP
login_ip_limiter = InMemoryIPRateLimiter(max_requests=5, window_seconds=60)
