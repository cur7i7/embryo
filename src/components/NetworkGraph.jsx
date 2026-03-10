import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

const LINK_COLORS = {
  teacher: '#D6C07F',
  influence: '#B68AAE',
  peer: '#8DB6BE',
  collaboration: '#D68E68',
  rivalry: '#B85C6B',
  default: '#AA737D',
}

const NODE_STROKE = 'rgba(255, 247, 199, 0.5)'
const NODE_STROKE_SELECTED = '#FFF7C7'

const EDGE_DASH = {
  influence: '4 3',
  rivalry: '3 4',
}

const EDGE_DISTANCE = {
  teacher: 78,
  influence: 105,
  peer: 82,
  collaboration: 74,
  rivalry: 90,
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const nodeRadius = (degree) => 7 + Math.min(18, Math.sqrt(degree) * 3)

const applySelectionStyle = (selection, selectedArtistName) => {
  selection
    .select('circle')
    .attr('stroke', (d) =>
      d.name === selectedArtistName ? NODE_STROKE_SELECTED : NODE_STROKE,
    )
    .attr('stroke-width', (d) => (d.name === selectedArtistName ? 2.4 : 1.2))
    .style('filter', (d) =>
      d.name === selectedArtistName
        ? 'drop-shadow(0 0 10px rgba(255, 247, 199, 0.35))'
        : 'none',
    )
}

function NetworkGraph({
  artists,
  connections,
  degreeByName,
  selectedArtistName,
  onSelectArtist,
  genreColors,
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const simulationRef = useRef(null)
  const nodeSelectionRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const nodes = useMemo(
    () =>
      artists.map((artist) => ({
        ...artist,
        id: artist.name,
        radius: nodeRadius(degreeByName.get(artist.name) ?? 0),
        color: genreColors[artist.genreBucket] ?? genreColors.other,
      })),
    [artists, degreeByName, genreColors],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) {
        return
      }

      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const { width, height } = dimensions
    if (!svgRef.current || width < 20 || height < 20) {
      return undefined
    }

    const svg = d3.select(svgRef.current)
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const root = svg
      .selectAll('g.scene')
      .data([null])
      .join('g')
      .attr('class', 'scene')

    const linksLayer = root
      .selectAll('g.links')
      .data([null])
      .join('g')
      .attr('class', 'links')

    const nodesLayer = root
      .selectAll('g.nodes')
      .data([null])
      .join('g')
      .attr('class', 'nodes')

    const nodeByName = new Map(nodes.map((node) => [node.name, node]))

    const links = connections
      .map((connection, index) => {
        const source = nodeByName.get(connection.source_name)
        const target = nodeByName.get(connection.target_name)

        if (!source || !target) {
          return null
        }

        return {
          ...connection,
          id: `${connection.source_name}-${connection.target_name}-${connection.type}-${index}`,
          source,
          target,
        }
      })
      .filter(Boolean)

    const transition = svg.transition().duration(420).ease(d3.easeCubicOut)

    const linkSelection = linksLayer
      .selectAll('line')
      .data(links, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append('line')
            .attr('x1', width / 2)
            .attr('y1', height / 2)
            .attr('x2', width / 2)
            .attr('y2', height / 2)
            .attr('opacity', 0)
            .attr('stroke-linecap', 'round')
            .call((el) =>
              el
                .attr('stroke', (d) => LINK_COLORS[d.type] ?? LINK_COLORS.default)
                .attr(
                  'stroke-width',
                  (d) => 1 + Math.max(0, Number(d.confidence) || 0) * 1.7,
                )
                .attr('stroke-dasharray', (d) => EDGE_DASH[d.type] ?? null)
                .transition(transition)
                .attr('opacity', 0.8),
            ),
        (update) =>
          update.call((el) =>
            el
              .transition(transition)
              .attr('stroke', (d) => LINK_COLORS[d.type] ?? LINK_COLORS.default)
              .attr(
                'stroke-width',
                (d) => 1 + Math.max(0, Number(d.confidence) || 0) * 1.7,
              )
              .attr('stroke-dasharray', (d) => EDGE_DASH[d.type] ?? null)
              .attr('opacity', 0.8),
          ),
        (exit) =>
          exit.call((el) => el.transition(transition).attr('opacity', 0).remove()),
      )

    const drag = d3
      .drag()
      .on('start', (event, draggedNode) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.25).restart()
        }
        draggedNode.fx = draggedNode.x
        draggedNode.fy = draggedNode.y
      })
      .on('drag', (event, draggedNode) => {
        draggedNode.fx = event.x
        draggedNode.fy = event.y
      })
      .on('end', (event, draggedNode) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0)
        }
        draggedNode.fx = null
        draggedNode.fy = null
      })

    const nodeSelection = nodesLayer
      .selectAll('g.node')
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const group = enter
            .append('g')
            .attr('class', 'node')
            .attr('opacity', 0)
            .style('cursor', 'pointer')

          group
            .append('circle')
            .attr('r', (d) => d.radius)
            .attr('fill', (d) => d.color)

          group
            .append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#FFF7C7')
            .style('font-size', '0.68rem')
            .style('font-weight', 600)
            .style('pointer-events', 'none')
            .style('text-shadow', '0 2px 8px rgba(35, 11, 25, 0.8)')
            .text((d) => d.name)

          group.call(drag)
          group.on('click', (_, node) => onSelectArtist(node.name))

          return group.call((el) =>
            el.transition(transition).attr('opacity', 1),
          )
        },
        (update) => update,
        (exit) =>
          exit.call((el) => el.transition(transition).attr('opacity', 0).remove()),
      )

    nodeSelection
      .select('circle')
      .transition(transition)
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('stroke', NODE_STROKE)
      .attr('stroke-width', 1.2)
      .style('filter', 'none')

    nodeSelection
      .select('text')
      .text((d) => d.name)
      .transition(transition)
      .attr('y', (d) => d.radius + 13)

    nodeSelectionRef.current = nodeSelection

    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((link) => EDGE_DISTANCE[link.type] ?? 88)
          .strength(0.45),
      )
      .force('charge', d3.forceManyBody().strength(-95))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.025))
      .force('y', d3.forceY(height / 2).strength(0.025))
      .force('collision', d3.forceCollide().radius((d) => d.radius + 9).iterations(2))
      .alpha(1)
      .alphaDecay(0.07)

    simulation.on('tick', () => {
      nodeSelection.attr('transform', (d) => {
        const margin = d.radius + 10
        const x = clamp(d.x ?? width / 2, margin, width - margin)
        const y = clamp(d.y ?? height / 2, margin, height - margin)
        d.x = x
        d.y = y

        return `translate(${x},${y})`
      })

      linkSelection
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
    })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [nodes, connections, dimensions, onSelectArtist])

  useEffect(() => {
    if (nodeSelectionRef.current) {
      applySelectionStyle(nodeSelectionRef.current, selectedArtistName)
    }
  }, [selectedArtistName, nodes])

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[460px] w-full overflow-hidden rounded-[1.6rem] border border-mesa/45 bg-burgundy-panel/80"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(170,115,125,0.22),transparent_48%),radial-gradient(circle_at_86%_74%,rgba(255,247,199,0.12),transparent_44%)]" />
      <svg
        ref={svgRef}
        className="relative z-10 h-full w-full"
        role="img"
        aria-label="Force-directed network of music artists"
      />
      {artists.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-burgundy/55 px-4 text-center text-sm text-cream/80">
          No artists active in this year.
        </div>
      )}
    </div>
  )
}

export default NetworkGraph
