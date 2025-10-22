import os
import json
import tempfile
import errno
import fcntl
from contextlib import contextmanager


def atomic_write_json(obj, dest_path):
    """Atomically write JSON object to dest_path.
    Writes to a temp file in same directory, fsyncs, then os.replace.
    """
    dest_dir = os.path.dirname(os.path.abspath(dest_path)) or '.'
    os.makedirs(dest_dir, exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(prefix='.tmp_metadata_', dir=dest_dir, text=True)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(obj, fh, indent=2, sort_keys=True)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, dest_path)
    except Exception:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise


def append_jsonl(obj, history_path):
    """Append a JSON object as one line to history_path, flush and fsync.
    """
    history_dir = os.path.dirname(os.path.abspath(history_path)) or '.'
    os.makedirs(history_dir, exist_ok=True)
    line = json.dumps(obj, sort_keys=True, ensure_ascii=False)
    # Open in append mode and ensure content is flushed to disk
    with open(history_path, 'a', encoding='utf-8') as fh:
        fh.write(line + '\n')
        fh.flush()
        os.fsync(fh.fileno())


@contextmanager
def file_lock(lock_path):
    """Simple POSIX advisory lock using fcntl on a lock file.
    Falls back to no-op if lock file can't be created.
    """
    fd = None
    try:
        os.makedirs(os.path.dirname(lock_path) or '.', exist_ok=True)
        fd = open(lock_path, 'w')
        try:
            fcntl.flock(fd.fileno(), fcntl.LOCK_EX)
        except Exception:
            # If flock is not supported, proceed without locking (best effort)
            pass
        yield
    finally:
        try:
            if fd:
                try:
                    fcntl.flock(fd.fileno(), fcntl.LOCK_UN)
                except Exception:
                    pass
                fd.close()
        except Exception:
            pass


def write_metadata_with_lock(metadata_obj, metadata_path, history_path, lock_path=None):
    """Append to history and atomically write current metadata, under optional lock.
    If lock_path is None, will still perform writes but without locking.
    """
    if lock_path is None:
        # Write history first, then atomically replace current metadata
        append_jsonl(metadata_obj, history_path)
        atomic_write_json(metadata_obj, metadata_path)
        return

    with file_lock(lock_path):
        append_jsonl(metadata_obj, history_path)
        atomic_write_json(metadata_obj, metadata_path)
