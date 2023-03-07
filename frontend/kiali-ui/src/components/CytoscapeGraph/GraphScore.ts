import { DecoratedGraphElements, DecoratedGraphNodeWrapper } from '../../types/Graph';

export enum ScoringCriteria {
  InboundEdges = 'InboundEdges',
  OutboundEdges = 'OutboundEdges'
}

function scoreByEdges(
  elements: Readonly<DecoratedGraphElements>,
  criteria: ScoringCriteria.InboundEdges | ScoringCriteria.OutboundEdges
): Map<string, number | undefined> {
  const totalEdgeCount = elements.edges?.length;

  const edgeCountById = new Map<string, number>();
  elements.edges?.forEach(edge => {
    const nodeId = criteria === ScoringCriteria.InboundEdges ? edge.data.target : edge.data.source;
    if (edgeCountById.has(nodeId)) {
      const newVal = edgeCountById.get(nodeId)! + 1;
      edgeCountById.set(nodeId, newVal);
    } else {
      edgeCountById.set(nodeId, 1);
    }
  });

  let scores = new Map<string, number | undefined>();
  elements.nodes?.forEach(node => {
    // Nodes without edges get a default score of 0.
    let score = 0;
    const edgeCount = edgeCountById.get(node.data.id);
    if (edgeCount !== undefined && totalEdgeCount !== undefined) {
      score = edgeCount / totalEdgeCount;
    }

    scores.set(node.data.id, score);
  });

  return scores;
}

// scores nodes by counting the number of "target" edges for each node.
function scoreByInboundEdges(elements: Readonly<DecoratedGraphElements>): Map<string, number | undefined> {
  return scoreByEdges(elements, ScoringCriteria.InboundEdges);
}

// scores nodes by counting number of "source" edges for each node.
function scoreByOutboundEdges(elements: Readonly<DecoratedGraphElements>): Map<string, number | undefined> {
  return scoreByEdges(elements, ScoringCriteria.OutboundEdges);
}

type ScoredNode = DecoratedGraphNodeWrapper & {
  score: number;
};

// Adds a score to the node elements based on the criteria(s).
// Scores are all relative to the other nodes. Criteria
// can include any source of data but typically looks at
// data from elements such as edge info.
export function scoreNodes(
  elements: Readonly<DecoratedGraphElements>,
  ...criterias: ScoringCriteria[]
): { elements: DecoratedGraphElements; upperBound: number } {
  // Zeroes out old scores and ranks if no ScoringCriteria is passed in.
  if (criterias.length === 0) {
    return {
      elements: {
        nodes: elements.nodes?.map(node => {
          node.data.rank = undefined;
          return node;
        }),
        edges: elements.edges
      },
      upperBound: 0
    };
  }

  let totalScore = new Map<string, number | undefined>();
  // TODO: This can probably be parallelized.
  for (const criteria of criterias) {
    let scoreForCriteria: Map<string, number | undefined> = new Map<string, number | undefined>();
    switch (criteria) {
      case ScoringCriteria.InboundEdges:
        scoreForCriteria = scoreByInboundEdges(elements);
        break;
      case ScoringCriteria.OutboundEdges:
        scoreForCriteria = scoreByOutboundEdges(elements);
        break;
    }

    scoreForCriteria.forEach((score, id) => {
      const totalScoreOfNode = totalScore.get(id);
      if (totalScoreOfNode !== undefined && score !== undefined) {
        totalScore.set(id, totalScoreOfNode + score);
      } else if (score !== undefined) {
        totalScore.set(id, score);
      }
    });
  }

  const scoredNodes = elements.nodes?.map(node => {
    let score = totalScore.has(node.data.id) ? totalScore.get(node.data.id) : undefined;
    return { ...node, score: score } as ScoredNode;
  });

  const sortedByScore = scoredNodes?.sort((a, b) => {
    const scoreA = a.score;
    const scoreB = b.score;
    if (scoreA !== undefined && scoreB === undefined) {
      return -1;
    }
    if (scoreB !== undefined && scoreA === undefined) {
      return 1;
    }
    if (scoreA === undefined && scoreB === undefined) {
      return 0;
    }

    return scoreB! - scoreA!;
  });

  let prevScore: number | undefined;
  let currentRank = 1; // Start rankings at 1
  const rankedNodes = sortedByScore?.map(node => {
    const currentScore = node.score;
    // No score means no rank
    if (currentScore === undefined) {
      return node;
    }

    // First score won't have a previous score
    if (prevScore === undefined) {
      prevScore = currentScore;
    }

    // Lower rank number is better. Smaller score means a lower rank but a higher rank number.
    if (prevScore > currentScore) {
      currentRank += 1;
    }

    node.data.rank = currentRank;
    prevScore = currentScore;

    return node;
  });

  const { normalizedElements, upperBound } = normalizeRanks({
    nodes: rankedNodes,
    edges: elements.edges
  } as DecoratedGraphElements);

  return {
    elements: normalizedElements,
    upperBound
  };
}

// normalizeRanks normalizes the ranks for the given nodes so that ranks for
// all the nodes fall between 1..100.
function normalizeRanks(
  elements: Readonly<DecoratedGraphElements>
): { normalizedElements: DecoratedGraphElements; upperBound: number } {
  const { nodes, edges } = elements;
  if (nodes === undefined) {
    return { normalizedElements: elements, upperBound: 0 };
  }

  const minRange = 1;
  const minRank = nodes.length >= 1 ? 1 : undefined;
  let maxRank: number | undefined;
  for (const node of nodes) {
    if (node.data.rank === undefined) {
      break;
    }
    maxRank = node.data.rank;
  }

  // If there's no min/max then we can't normalize
  if (minRank === undefined || maxRank === undefined) {
    return { normalizedElements: elements, upperBound: 0 };
  }

  const upperBound = maxRank < 100 ? maxRank : 100;

  const normalizedNodes = nodes.map(node => {
    if (node.data.rank === undefined) {
      return node;
    }

    // All nodes are the same rank and we want to avoid div by 0
    if (maxRank === minRank) {
      node.data.rank = minRank;
      return node;
    }

    const normalizedRank = (minRange + (node.data.rank - minRank) * (upperBound - minRange)) / (maxRank! - minRank);
    // Ranks should be whole numbers
    node.data.rank = Math.ceil(normalizedRank);

    return node;
  });

  return {
    normalizedElements: {
      nodes: normalizedNodes,
      edges: edges
    },
    upperBound: upperBound
  };
}
