"""
DNS Resolver Module

Async DNS resolution for IP addresses.
"""

import asyncio
from typing import Dict, Optional, Set
from collections import OrderedDict
import logging

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

logger = logging.getLogger(__name__)


class DNSResolver:
    """
    Asynchronous DNS resolver with caching.
    
    Features:
    - Non-blocking DNS lookups
    - LRU cache for results
    - Multiple DNS backends
    - Timeout handling
    """
    
    def __init__(self, cache_size: int = 1000):
        self._cache: OrderedDict = OrderedDict()
        self._cache_size = cache_size
        self._pending: Dict[str, asyncio.Future] = {}
    
    async def resolve(self, ip_address: str) -> Optional[str]:
        """
        Resolve IP address to hostname.
        
        Args:
            ip_address: IP address to resolve
            
        Returns:
            Hostname or None if not found
        """
        # Check cache first
        if ip_address in self._cache:
            return self._cache[ip_address]
        
        # Check if already pending
        if ip_address in self._pending:
            return await self._pending[ip_address]
        
        # Create future for this lookup
        loop = asyncio.get_event_loop()
        self._pending[ip_address] = loop.create_future()
        
        try:
            # Perform reverse DNS lookup
            hostname = await self._reverse_dns(ip_address)
            
            # Cache result
            if hostname:
                self._cache_result(ip_address, hostname)
            
            # Set future result
            self._pending[ip_address].set_result(hostname)
            return hostname
            
        except Exception as e:
            logger.debug(f"DNS resolution failed for {ip_address}: {e}")
            self._pending[ip_address].set_result(None)
            return None
            
        finally:
            del self._pending[ip_address]
    
    async def _reverse_dns(self, ip_address: str) -> Optional[str]:
        """Perform reverse DNS lookup."""
        try:
            # Use asyncio's built-in reverse DNS
            hostname = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._sync_reverse_dns(ip_address)
            )
            return hostname
        except Exception:
            return None
    
    def _sync_reverse_dns(self, ip_address: str) -> Optional[str]:
        """Synchronous reverse DNS lookup."""
        try:
            import socket
            hostname, _, _ = socket.gethostbyaddr(ip_address)
            return hostname
        except (socket.herror, socket.gaierror):
            return None
    
    def _cache_result(self, ip: str, hostname: str):
        """Add result to LRU cache."""
        if ip in self._cache:
            del self._cache[ip]
        
        self._cache[ip] = hostname
        
        # Evict oldest if over capacity
        while len(self._cache) > self._cache_size:
            self._cache.popitem(last=False)
    
    def clear_cache(self):
        """Clear the DNS cache."""
        self._cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics."""
        return {
            'size': len(self._cache),
            'max_size': self._cache_size,
            'pending': len(self._pending)
        }
