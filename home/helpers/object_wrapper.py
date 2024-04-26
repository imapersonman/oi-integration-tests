from typing import Generic, TypeVar


T = TypeVar("T")
class ObjectWrapper(Generic[T]):
    def __init__(self, obj: T):
        self.obj = obj
    
    def __getattr__(self, attr):
        original = getattr(self.obj, attr)
        if callable(original):
            name_str = original.__name__
            def wrapped(*args, **kwargs):
                args_strs = map(str, args)
                kwargs_strs = [f"{k}={v}" for k, v in kwargs]
                given_args_str = ", ".join([*args_strs, *kwargs_strs])
                print(f"{name_str}({given_args_str})")
                return original(*args, **kwargs)
            return wrapped
        else:
            return original


def wrap(obj: T) -> T:
    # nasty nasty ignore but it should work so whatevs.
    return ObjectWrapper(obj) # type: ignore
