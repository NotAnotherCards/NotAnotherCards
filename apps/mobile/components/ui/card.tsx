import { Text, TextClassContext } from '@/components/ui/text';
import { cardShadows } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

function Card({
  className,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  const { colorScheme } = useColorScheme();
  const boxShadow = cardShadows[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          'bg-card border-sage-border flex flex-col gap-6 rounded-2xl border py-6',
          className,
        )}
        style={[{ boxShadow }, style]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />
  );
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn('font-semibold leading-tight', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return (
    <Text
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('px-6', className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      className={cn('flex flex-row items-center px-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
