import type { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';
import { Card, CardTitle } from './ui/card';

// Details that would crowd a screen, opened over it on demand. An info
// panel, not a dialog: a tap anywhere closes it, like the back button.
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
      <Pressable
        accessibilityLabel="Close"
        className="flex-1 items-center justify-center bg-black/50 p-6"
        onPress={onClose}
      >
        <Card className="w-full gap-3 px-5 py-5">
          <CardTitle className="text-base">{title}</CardTitle>
          {children}
        </Card>
      </Pressable>
    </Modal>
  );
}
