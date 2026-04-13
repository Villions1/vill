"""
Logging Configuration Module

Sets up structured logging for the application.
"""

import logging
import sys
from typing import Optional
from pathlib import Path


def setup_logging(log_level: str = 'INFO', 
                  log_file: Optional[str] = None,
                  verbose: bool = False) -> logging.Logger:
    """
    Configure application logging.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional file path for log output
        verbose: Enable verbose output
        
    Returns:
        Configured logger instance
    """
    # Get root logger
    logger = logging.getLogger('netwatch')
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatter
    if verbose:
        fmt = '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s'
    else:
        fmt = '%(asctime)s | %(levelname)-8s | %(message)s'
    
    formatter = logging.Formatter(fmt, datefmt='%Y-%m-%d %H:%M:%S')
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        try:
            # Ensure log directory exists
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            file_handler.setLevel(logging.DEBUG)
            logger.addHandler(file_handler)
            
        except Exception as e:
            print(f"Warning: Could not create log file: {e}")
    
    return logger


def get_logger(name: str = 'netwatch') -> logging.Logger:
    """Get a logger instance with the specified name."""
    return logging.getLogger(name)
