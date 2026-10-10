import { bakePieAction } from "./actions";

export function BakeForm() {
  return (
    <form action={bakePieAction} className="card">
      <h2>Bake your pie</h2>
      <p>How much comes in every month? It gets cut into Needs, Wants and Savings.</p>
      <input name="monthlyIncome" type="number" min="1" step="0.01" required placeholder="3000" />
      <button type="submit">Bake</button>
    </form>
  );
}
