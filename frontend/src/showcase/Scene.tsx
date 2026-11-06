import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { SCENE_PROGRESS_EVENT } from './motion';
import styles from './showcase.module.css';

export type SceneId = 1 | 2 | 3 | 4 | 5 | 6;

export interface SceneProps {
  id: SceneId;
  /** Cena que o scroll prende na janela enquanto o progresso corre de 0 a 1 (o motor lê `data-pinned`). */
  pinned?: boolean;
  className?: string;
  children: ReactNode;
}

const SceneElement = createContext<RefObject<HTMLElement | null> | null>(null);

/**
 * O progresso (0 a 1) da cena que contém quem chama, para o que não dá para desenhar só com CSS: um texto que muda com o
 * scroll, como o saldo da cena 3. Só quem usa este hook renderiza de novo a cada passo, e só quando o valor muda (o motor
 * avisa pela própria cena); o resto da vitrine segue no CSS, sem React no meio do scroll. Fora de uma cena, fica em 0.
 */
export function useSceneProgress(): number {
  const element = useContext(SceneElement);
  const subscribe = useCallback(
    (notify: () => void) => {
      const section = element?.current;
      section?.addEventListener(SCENE_PROGRESS_EVENT, notify);
      return () => section?.removeEventListener(SCENE_PROGRESS_EVENT, notify);
    },
    [element],
  );
  return useSyncExternalStore(subscribe, () => Number(element?.current?.dataset['progress'] ?? 0));
}

/**
 * Uma cena da vitrine. O motor (useScrollScenes) a encontra por `[data-scene]` e escreve o progresso dela, de 0 a 1,
 * em `data-progress` (três casas) e na variável CSS `--p`: o CSS desenha tudo a partir de `--p`, sem React no meio do
 * scroll. As duas começam em zero; o React não as reescreve, porque o valor delas não muda entre renders.
 */
export function Scene({ id, pinned = false, className, children }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  return (
    <SceneElement.Provider value={ref}>
      <section
        ref={ref}
        className={[styles.scene, className].filter(Boolean).join(' ')}
        data-scene={id}
        data-pinned={pinned ? '' : undefined}
        data-progress="0.000"
        style={{ '--p': 0 } as CSSProperties}
      >
        {children}
      </section>
    </SceneElement.Provider>
  );
}
