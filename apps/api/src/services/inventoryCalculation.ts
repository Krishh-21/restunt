export function receiveStock(
  previousQuantity: number,
  previousCost: number,
  receivedQuantity: number,
  receivedCost: number
) {
  if (
    ![previousQuantity, previousCost, receivedQuantity, receivedCost].every(Number.isFinite) ||
    previousQuantity < 0 ||
    previousCost < 0 ||
    receivedQuantity <= 0 ||
    receivedCost < 0
  )
    throw new Error('Invalid goods receipt');
  const quantity = previousQuantity + receivedQuantity;
  return {
    quantity,
    weightedAverageCost:
      (previousQuantity * previousCost + receivedQuantity * receivedCost) / quantity,
  };
}
