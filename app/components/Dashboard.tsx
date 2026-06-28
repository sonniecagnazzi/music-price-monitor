async function checkOne(id: string) {
  setBusy(true);
  setMessage('Avvio controllo singolo su GitHub Actions...');

  try {
    const response = await fetch(`/api/monitors/${id}/check`, {
      method: 'POST'
    });

    const json = (await response.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(json.error || 'Errore avvio controllo singolo.');
    }

    setMessage(
      json.message ||
        'Controllo singolo avviato su GitHub Actions. Aggiorna tra 1-2 minuti.'
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : 'Errore durante avvio controllo singolo.'
    );
  } finally {
    setBusy(false);
  }
}

async function checkVisibleRows() {
  if (filtered.length === 0) {
    setMessage('Nessun record visibile da controllare.');
    return;
  }

  const confirmed = confirm(
    'Vuoi avviare ora il controllo GitHub Actions per tutti i monitor attivi?'
  );

  if (!confirmed) return;

  setBusy(true);
  setMessage('Avvio controllo completo su GitHub Actions...');

  try {
    const response = await fetch('/api/monitors/check-all', {
      method: 'POST'
    });

    const json = (await response.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(json.error || 'Errore avvio controllo completo.');
    }

    setMessage(
      json.message ||
        'Controllo completo avviato su GitHub Actions. Aggiorna tra qualche minuto.'
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : 'Errore durante avvio controllo completo.'
    );
  } finally {
    setBusy(false);
  }
}
