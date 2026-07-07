// useDrillBack (#220) — makes the platform "back" gestures step the DRILL STACK before leaving the
// screen (mirrors desktop #2492's back-steps-the-drill behavior):
//   • Android hardware back — BackHandler: pops the drill and swallows the event while drilled.
//   • iOS swipe-back (and any navigator-driven removal) — react-navigation's `beforeRemove`:
//     prevented + converted into a drill pop while drilled; leaves normally at the root.
// Must be mounted under a navigator (expo-router — the whole app is).
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from 'expo-router';

export function useDrillBack(canPop: boolean, pop: () => void): void {
  // Refs so the (once-registered) listeners always see the live values.
  const canPopRef = useRef(canPop);
  canPopRef.current = canPop;
  const popRef = useRef(pop);
  popRef.current = pop;

  const navigation = useNavigation();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canPopRef.current) return false; // at the root — let the system handle it
      popRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!canPopRef.current) return; // at the root — leave the screen normally
      e.preventDefault();
      popRef.current();
    });
  }, [navigation]);
}
