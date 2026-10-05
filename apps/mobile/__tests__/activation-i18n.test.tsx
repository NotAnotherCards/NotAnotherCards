import { ActivationControls } from '@/components/review/activation-controls';
import { renderWithLocale } from '@/lib/test-utils/render-with-locale';

it.each([
  [21, 'Доступна 21 неактивная карточка'],
  [22, 'Доступны 22 неактивные карточки'],
  [25, 'Доступно 25 неактивных карточек'],
])(
  'uses Russian plural rules for %i inactive cards',
  async (count, expected) => {
    const screen = await renderWithLocale(
      <ActivationControls
        count="5"
        onChangeCount={jest.fn()}
        onActivate={jest.fn()}
        isActivating={false}
        error={null}
        inactiveItemCount={count}
        itemLabel="cards"
      />,
      'ru',
    );
    expect(screen.getByText(expected)).toBeTruthy();
  },
);
