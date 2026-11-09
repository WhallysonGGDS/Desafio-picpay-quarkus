import { Button } from '../../design/Button';
import { Wordmark } from '../../design/Wordmark';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './NotFound.module.css';

/**
 * A tela de qualquer erro ao desenhar uma rota (uma exceção, ou o pacote de uma tela que não existe mais numa aba aberta antes de uma
 * atualização do Arco). Sem ela, o React Router mostra a própria página de erro: em inglês, com a pilha e sem saída.
 */
export function RouteError() {
  useDocumentTitle('Algo deu errado');
  return (
    <main className={styles.page}>
      <Wordmark />
      <h1 className={styles.title}>Algo deu errado.</h1>
      <p className={styles.hint}>Não deu para mostrar esta tela. Recarregar costuma resolver, principalmente depois de uma atualização do Arco.</p>
      <Button onClick={() => window.location.reload()}>Recarregar a página</Button>
    </main>
  );
}
