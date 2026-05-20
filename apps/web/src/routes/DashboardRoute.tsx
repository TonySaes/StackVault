export function DashboardRoute() {
  return (
    <main className="app-shell" aria-labelledby="dashboard-title">
      <section className="hero-section">
        <p className="eyebrow">Veille developpeur verifiable</p>
        <h1 id="dashboard-title">StackVault</h1>
        <p className="lede">
          Un dashboard public minimal est pret. Les releases, signaux de securite
          et tendances seront ajoutes par increments dedies.
        </p>
      </section>

      <section className="placeholder-panel" aria-labelledby="next-signals-title">
        <h2 id="next-signals-title">Flux de ressources</h2>
        <p>
          Aucune ressource n'est encore chargee. Cette premiere interface valide
          seulement le socle React/Vite et la structure accessible de la page.
        </p>
      </section>
    </main>
  );
}
