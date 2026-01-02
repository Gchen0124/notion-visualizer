import { useCallback, useRef } from 'react';
import { timer } from 'd3-timer';
import { easeCubicInOut } from 'd3-ease';

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface AnimationOptions {
  duration?: number;
  easing?: (t: number) => number;
  onStart?: () => void;
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
}

/**
 * Hook for animating React Flow nodes to new positions
 * Creates a smooth "Transformer" style animation effect
 */
export function useAnimatedNodes<T extends { id: string; position: { x: number; y: number } }>() {
  const animationRef = useRef<ReturnType<typeof timer> | null>(null);

  const animateToLayout = useCallback(
    (
      currentNodes: T[],
      targetLayout: LayoutItem[],
      setNodes: React.Dispatch<React.SetStateAction<T[]>>,
      options: AnimationOptions = {}
    ) => {
      const {
        duration = 800,
        easing = easeCubicInOut,
        onStart,
        onComplete,
        onProgress,
      } = options;

      // Cancel any existing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      // Store start positions
      const startPositions = new Map<string, { x: number; y: number }>();
      currentNodes.forEach((node) => {
        startPositions.set(node.id, { x: node.position.x, y: node.position.y });
      });

      // Store target positions
      const targetPositions = new Map<string, { x: number; y: number }>();
      targetLayout.forEach((item) => {
        targetPositions.set(item.id, { x: item.x, y: item.y });
      });

      onStart?.();

      const startTime = Date.now();

      animationRef.current = timer(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);

        onProgress?.(progress);

        setNodes((nodes) =>
          nodes.map((node) => {
            const start = startPositions.get(node.id);
            const target = targetPositions.get(node.id);

            if (!start || !target) return node;

            // Linear interpolation with easing
            const x = start.x + (target.x - start.x) * easedProgress;
            const y = start.y + (target.y - start.y) * easedProgress;

            return {
              ...node,
              position: { x, y },
            };
          })
        );

        if (progress >= 1) {
          animationRef.current?.stop();
          animationRef.current = null;
          onComplete?.();
          return true;
        }

        return false;
      });
    },
    []
  );

  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }, []);

  return { animateToLayout, cancelAnimation };
}

export default useAnimatedNodes;
