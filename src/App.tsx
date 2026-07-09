import { Card } from './components/card/Card';
import { CardBack } from './components/card/CardBack';
import { Board } from './components/board/Board';
import type { BoardCardData } from './components/board/BoardCell';

/**
 * Root application component.
 *
 * This is a placeholder for Phase 0-7 - it will be overwritten in Phase 8.7
 * once all screens (Home, ArmyBuilder, RuleSelect, Game, Result) exist and
 * can be wired into a real screen-flow router. For now it renders the Card
 * and Board components directly so they can be visually verified during
 * development.
 */
export default function App() {
  const boardCells: (BoardCardData | null)[][] = [
    [null, { name: 'Lychguard', stats: { top: 5, bottom: 5, left: 6, right: 6 }, portraitPath: 'assets/factions/necrons/units/lychguard.png', owner: 'red' }, null],
    [null, null, null],
    [null, null, null],
  ];

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '2rem',
        background: '#111',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', gap: '2rem' }}>
        <Card
          name="Commander Dante"
          stats={{ top: 8, bottom: 5, left: 6, right: 6 }}
          portraitPath="assets/factions/blood-angels/units/commander-dante.png"
          owner="blue"
          width={220}
        />
        <Card
          name="Chief Librarian Mephiston"
          stats={{ top: 9, bottom: 6, left: 5, right: 7 }}
          portraitPath="assets/factions/blood-angels/units/chief-librarian-mephiston.png"
          owner="red"
          width={220}
          interactive
          selected
        />
        <CardBack owner="red" width={220} />
      </div>
      <Board
        cells={boardCells}
        highlightedPositions={[{ row: 1, col: 1 }, { row: 2, col: 0 }]}
        onCellClick={(pos) => console.log('clicked', pos)}
        cardWidth={140}
      />
    </div>
  );
}