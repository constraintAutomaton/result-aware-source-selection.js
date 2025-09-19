function generateCombinations<T>(arr: T[]): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      result.push([arr[i]!, arr[j]!]);
    }
  }

  return result;
}

// Example usage:
const arr = [1, 2];
console.log(generateCombinations(arr));