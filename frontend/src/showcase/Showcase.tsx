import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { COPY } from './copy';
import { Scene } from './Scene';
import { ScrollArc } from './ScrollArc';
import styles from './showcase.module.css';
import { useScrollScenes } from './useScrollScenes';

// O motor: seis cenas, o scroll escreve o progresso de cada uma e o arco o desenha. Exporta por padrão porque a rota "/"
// a carrega sob demanda (lazy): o GSAP e o Lenis só existem neste pacote. O conteúdo de cada cena entra nas próximas
// etapas; aqui está o esqueleto que o motor move.
export default function Showcase() {
  const root = useRef<HTMLElement>(null);
  useScrollScenes(root);

  return (
    <main ref={root}>
      <Scene id={1} className={styles.placeholder}>
        <h1>{COPY.titles[1]}</h1>
        <div className={styles.placeholderArc}>
          <ScrollArc />
        </div>
      </Scene>
      <Scene id={2} pinned className={styles.placeholder}>
        <h2>{COPY.titles[2]}</h2>
        <div className={styles.placeholderArc}>
          <ScrollArc nodes={4} />
        </div>
      </Scene>
      <Scene id={3} pinned className={styles.placeholder}>
        <h2>{COPY.titles[3]}</h2>
      </Scene>
      <Scene id={4} className={styles.placeholder}>
        <h2>{COPY.titles[4]}</h2>
      </Scene>
      <Scene id={5} className={styles.placeholder}>
        <h2>{COPY.titles[5]}</h2>
      </Scene>
      <Scene id={6} className={styles.placeholder}>
        <h2>{COPY.titles[6]}</h2>
        <Link to={ROUTES.register}>{COPY.cta}</Link>
      </Scene>
    </main>
  );
}
