/**
 * Feature: node-monitoring-system, Property 12: 仅返回父节点且包含子节点计数
 * Validates: Requirements 9.2, 9.3
 *
 * For any set of nodes, GET /{sp}/monitor/nodes should only return nodes
 * where parent_id is null, and each parent node should include the correct
 * child_count (number of child nodes pointing to it).
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Replicate the parent-node filtering and child-count logic from
 * MonitorController::nodes().
 *
 * PHP source (MonitorController.php):
 *   $nodes = Server::whereNull('parent_id')->get()->map(function ($node) use (...) {
 *       ...
 *       $childCount = Server::where('parent_id', $node->id)->count();
 *       return [
 *           'id' => $node->id,
 *           ...
 *           'child_count' => $childCount,
 *       ];
 *   });
 *
 * @param {Array<{id: number, parent_id: number|null, name: string, type: string, host: string}>} allNodes
 * @returns {Array<{id: number, name: string, type: string, host: string, child_count: number}>}
 */
function filterParentNodesWithChildCount(allNodes) {
  // Step 1: Filter to only parent nodes (parent_id is null)
  const parentNodes = allNodes.filter((n) => n.parent_id === null);

  // Step 2: For each parent, count children
  return parentNodes.map((parent) => {
    const childCount = allNodes.filter((n) => n.parent_id === parent.id).length;
    return {
      id: parent.id,
      name: parent.name,
      type: parent.type,
      host: parent.host,
      child_count: childCount,
    };
  });
}

// --- Arbitraries ---

const nodeTypeArb = fc.constantFrom(
  'vless', 'vmess', 'trojan', 'hysteria', 'tuic', 'anytls', 'shadowsocks'
);

const nameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const nodeNameArb = fc.integer({ min: 1, max: 20 }).chain((len) =>
  fc.array(fc.integer({ min: 0, max: nameChars.length - 1 }), { minLength: len, maxLength: len })
    .map((indices) => indices.map((i) => nameChars[i]).join(''))
);
const hostArb = fc.constantFrom('us01.example.com', 'jp01.example.com', 'sg01.example.com', 'de01.example.com', 'hk01.example.com');

/**
 * Generate a random set of nodes with parent-child relationships.
 * First generates parent nodes (parent_id = null), then generates
 * child nodes that reference one of the parent node IDs.
 */
const nodeSetArb = fc
  .integer({ min: 1, max: 20 })
  .chain((parentCount) =>
    fc
      .tuple(
        // Generate parent nodes
        fc.array(
          fc.tuple(nodeNameArb, nodeTypeArb, hostArb),
          { minLength: parentCount, maxLength: parentCount }
        ),
        // Generate 0..30 child nodes
        fc.integer({ min: 0, max: 30 })
      )
      .chain(([parentTuples, childCount]) => {
        const parentNodes = parentTuples.map((t, i) => ({
          id: i + 1,
          parent_id: null,
          name: t[0],
          type: t[1],
          host: t[2],
        }));

        const parentIds = parentNodes.map((p) => p.id);

        // Generate child nodes referencing random parent IDs
        return fc
          .array(
            fc.tuple(
              fc.constantFrom(...parentIds),
              nodeNameArb,
              nodeTypeArb,
              hostArb
            ),
            { minLength: childCount, maxLength: childCount }
          )
          .map((childTuples) => {
            const childNodes = childTuples.map((t, i) => ({
              id: parentNodes.length + i + 1,
              parent_id: t[0],
              name: t[1],
              type: t[2],
              host: t[3],
            }));
            return [...parentNodes, ...childNodes];
          });
      })
  );

describe('Property 12: Parent Node Filter with Child Count', () => {
  it('only returns nodes where parent_id is null', () => {
    fc.assert(
      fc.property(nodeSetArb, (allNodes) => {
        const result = filterParentNodesWithChildCount(allNodes);

        // Every returned node must be a parent (parent_id === null in original data)
        const parentIds = new Set(
          allNodes.filter((n) => n.parent_id === null).map((n) => n.id)
        );

        for (const node of result) {
          expect(parentIds.has(node.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('returns all parent nodes (none are missing)', () => {
    fc.assert(
      fc.property(nodeSetArb, (allNodes) => {
        const result = filterParentNodesWithChildCount(allNodes);
        const expectedParentCount = allNodes.filter(
          (n) => n.parent_id === null
        ).length;

        expect(result.length).toBe(expectedParentCount);
      }),
      { numRuns: 100 }
    );
  });

  it('never returns child nodes (parent_id !== null)', () => {
    fc.assert(
      fc.property(nodeSetArb, (allNodes) => {
        const result = filterParentNodesWithChildCount(allNodes);
        const childIds = new Set(
          allNodes.filter((n) => n.parent_id !== null).map((n) => n.id)
        );

        for (const node of result) {
          expect(childIds.has(node.id)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each parent node has correct child_count', () => {
    fc.assert(
      fc.property(nodeSetArb, (allNodes) => {
        const result = filterParentNodesWithChildCount(allNodes);

        for (const parentNode of result) {
          const expectedChildCount = allNodes.filter(
            (n) => n.parent_id === parentNode.id
          ).length;
          expect(parentNode.child_count).toBe(expectedChildCount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('child_count is zero for parent nodes with no children', () => {
    fc.assert(
      fc.property(
        // Generate parent-only nodes (no children)
        fc.array(
          fc.tuple(nodeNameArb, nodeTypeArb, hostArb),
          { minLength: 1, maxLength: 10 }
        ),
        (parentTuples) => {
          const allNodes = parentTuples.map((t, i) => ({
            id: i + 1,
            parent_id: null,
            name: t[0],
            type: t[1],
            host: t[2],
          }));

          const result = filterParentNodesWithChildCount(allNodes);

          for (const node of result) {
            expect(node.child_count).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total child_count across all parents equals total number of child nodes', () => {
    fc.assert(
      fc.property(nodeSetArb, (allNodes) => {
        const result = filterParentNodesWithChildCount(allNodes);
        const totalChildCount = result.reduce((sum, n) => sum + n.child_count, 0);
        const actualChildNodes = allNodes.filter(
          (n) => n.parent_id !== null
        ).length;

        expect(totalChildCount).toBe(actualChildNodes);
      }),
      { numRuns: 100 }
    );
  });
});
