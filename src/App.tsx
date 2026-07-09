import { Card } from './components/card/Card';
import { CardBack } from './components/card/CardBack';

/**
 * Root application component.
 *
 * This is a placeholder for Phase 0-7 - it will be overwritten in Phase 8.7
 * once all screens (Home, ArmyBuilder, RuleSelect, Game, Result) exist and
 * can be wired into a real screen-flow router. For now it renders the Card
 * component directly so it can be visually verified during development.
 */
export default function App() {
  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '2rem',
        background: '#111',
        minHeight: '100vh',
        display: 'flex',
        gap: '2rem',
        alignItems: 'flex-start',
      }}
    >
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
  );
}