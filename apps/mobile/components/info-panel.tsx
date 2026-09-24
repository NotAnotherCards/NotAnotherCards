import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Card, CardTitle } from './ui/card';

// Details that would crowd a screen, opened over it on demand. An info
// panel, not a dialog: a tap anywhere closes it, like the back button, and
// a screen reader reaches its text and a Close button.
export function InfoPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-6">
        {/* The dimmed backdrop is the screen reader's way out; the panel
            is a sibling, not a child, so its text stays readable. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          className="bg-black/50"
        />
        {/* Tapping the panel closes it too, but it is no accessible
            element of its own: its title and text are read one by one. */}
        <Pressable accessible={false} onPress={onClose} className="w-full">
          <Card className="w-full gap-3 px-5 py-5">
            <CardTitle className="text-base">{title}</CardTitle>
            {children}
          </Card>
        </Pressable>
      </View>
    </Modal>
  );
}
