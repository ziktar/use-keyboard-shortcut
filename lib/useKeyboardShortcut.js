import { useEffect, useCallback, useRef, useMemo } from "react";
import {
  overrideSystemHandling,
  checkHeldKeysRecursive,
  uniq_fast,
} from "./utils";

const BLACKLISTED_DOM_TARGETS = ["TEXTAREA", "INPUT"];

const DEFAULT_OPTIONS = {
  overrideSystem: false,
  ignoreInputFields: true,
  repeatOnHold: true,
};

const useKeyboardShortcut = (shortcutKeys, callback, userOptions) => {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  if (!Array.isArray(shortcutKeys))
    throw new Error(
      "The first parameter to `useKeyboardShortcut` must be an ordered array of `KeyboardEvent.key` strings."
    );

  if (!shortcutKeys.length)
    throw new Error(
      "The first parameter to `useKeyboardShortcut` must contain atleast one `KeyboardEvent.key` string."
    );

  if (!callback || typeof callback !== "function")
    throw new Error(
      "The second parameter to `useKeyboardShortcut` must be a function that will be envoked when the keys are pressed."
    );

  const shortcutKeysId = useMemo(() => shortcutKeys.join(), [shortcutKeys]);

  // Normalizes the shortcut keys a deduplicated array of lowercased keys.
  const shortcutArray = useMemo(
    () => uniq_fast(shortcutKeys).map((key) => String(key).toLowerCase()),
    // While using .join() is bad for most larger objects, this shortcut
    // array is fine as it's small, according to the answer below.
    // https://github.com/facebook/react/issues/14476#issuecomment-471199055
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shortcutKeysId]
  );
  // useRef to avoid a constant re-render on keydown and keyup.
  const heldKeys = useRef([]);

  const keydownListener = useCallback(
    (keydownEvent) => {
      const loweredKey = String(keydownEvent.key).toLowerCase();
      if (!(shortcutArray.indexOf(loweredKey) >= 0)) return;

      if (
        options.ignoreInputFields &&
        BLACKLISTED_DOM_TARGETS.indexOf(keydownEvent.target.tagName) >= 0
      ) {
        return;
      }

      if (keydownEvent.repeat && !options.repeatOnHold) return;

      // This needs to be checked as soon as possible to avoid
      // all option checks that might prevent default behavior
      // of the key press.
      //
      // I.E If shortcut is "Shift + A", we shouldn't prevent the
      // default browser behavior of Select All Text just because
      // "A" is being observed for our custom behavior shortcut.
      const isHeldKeyCombinationValid = checkHeldKeysRecursive(
        loweredKey,
        null,
        shortcutArray,
        heldKeys.current
      );

      if (!isHeldKeyCombinationValid) {
        return;
      }

      const nextHeldKeys = [...heldKeys.current, loweredKey];
      if (nextHeldKeys.join() === shortcutArray.join()) {
        if (options.overrideSystem) {
          overrideSystemHandling(keydownEvent);
        }
        
        callback(shortcutKeys);
        return false;
      }

      heldKeys.current = nextHeldKeys;

      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shortcutKeysId,
      callback,
      options.overrideSystem,
      options.ignoreInputFields,
    ]
  );

  const keyupListener = useCallback(
    (keyupEvent) => {
      const raisedKey = String(keyupEvent.key).toLowerCase();
      if (!(shortcutArray.indexOf(raisedKey) >= 0)) return;

      const raisedKeyHeldIndex = heldKeys.current.indexOf(raisedKey);
      if (!(raisedKeyHeldIndex >= 0)) return;

      let nextHeldKeys = [];
      let loopIndex;
      for (loopIndex = 0; loopIndex < heldKeys.current.length; ++loopIndex) {
        if (loopIndex !== raisedKeyHeldIndex) {
          nextHeldKeys.push(heldKeys.current[loopIndex]);
        }
      }
      heldKeys.current = nextHeldKeys;

      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shortcutKeysId]
  );

  const flushHeldKeys = useCallback(() => {
    heldKeys.current = [];
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", keydownListener);
    window.addEventListener("keyup", keyupListener);
    return () => {
      window.removeEventListener("keydown", keydownListener);
      window.removeEventListener("keyup", keyupListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keydownListener, keyupListener, shortcutKeysId]);

  // Resets the held keys array if the shortcut keys are changed.
  useEffect(() => {
    flushHeldKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcutKeysId, flushHeldKeys]);

  return {
    flushHeldKeys,
  };
};

export default useKeyboardShortcut;
