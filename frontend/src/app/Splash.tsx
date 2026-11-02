import { Wordmark } from '../design/Wordmark';
import styles from './Splash.module.css';

// A tela de espera: só a marca, sem spinner. Aparece depois de um instante, para que uma resposta rápida não a pisque.
export function Splash() {
  return (
    <main className={styles.splash} aria-busy="true">
      <Wordmark className={styles.mark} />
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
