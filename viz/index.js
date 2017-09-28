const _ = require('lodash')
const resl = require('resl')
const css = require('dom-css')
const fit = require('canvas-fit')
const d3scales = require('d3-scale')
const d3chromatic = require('d3-scale-chromatic')
const d3color = require('d3-color')
const hexrgb = require('hex-rgb')
const control = require('control-panel')

// setup canvas and camera
const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')(canvas)
const camera = require('./camera.js')(canvas, {scale: true, rotate: true})
window.addEventListener('resize', fit(canvas), false)

// import draw functions
const drawBackground = require('./draw/background')(regl)
const drawSpots = require('./draw/spots')(regl)
const drawCircles = require('./draw/circles')(regl)
const drawRegions = require('./draw/regions')(regl)
const drawOutlines = require('./draw/outlines')(regl)

// load assets and draw
resl({
  manifest: {
    'background': {
      type: 'image',
      src: '../example_2/background.png'
    },

    'spots': {
      type: 'text',
      src: '../example_2/spots_decoded.json',
      parser: JSON.parse
    },

    'regions': {
      type: 'text',
      src: '../example_2/regions.json',
      parser: JSON.parse
    }
  },

  onDone: ({background, spots, regions}) => {
    const width = background.naturalWidth
    const height = background.naturalHeight
    const scale = height/width
    const texture = regl.texture(background)

    const counts = _.map(_.countBy(spots, 'properties.gene'), 
      function (k, v) {return {gene: v, count: k}})
    const top = _.map(_.orderBy(counts, 'count', 'desc'), 
      function (k) {return k.gene}).slice(1,10)

    const colorscale = d3scales.scaleOrdinal(d3chromatic.schemeAccent)
      .domain(top).unknown('#afafaf')

    var state = {
      showSpots: true,
      showRegions: true,
      showCircles: false,
      geneSelection: _.fill(Array(10), true)
    }

    var legend = top.map(function (gene) {
      return colorscale(gene)
    })

    var panel = control([
      {type: 'checkbox', label: 'show spots', initial: state.showSpots},
      {type: 'checkbox', label: 'show circles', initial: state.showCircles},
      {type: 'checkbox', label: 'show regions', initial: state.showRegions},
      {type: 'multibox', label: 'gene selection', names: top, initial: state.geneSelection, colors: legend}
    ],
      {theme: 'dark', position: 'top-left'}
    )
    panel.on('input', function (data) {
      state.showSpots = data['show spots']
      state.showCircles = data['show circles']
      state.showRegions = data['show regions']
      state.geneSelection = data['gene selection']
      colors = getcolors(spots)
    })

    var xy
    const positions = spots.map(function (spot) {
      xy = spot.geometry.coordinates
      return [xy[1] / (width / 2) - 1.0, xy[0] / (height / 2) - 1]
    })

    const vertices = regions.map(function (region) {
      return region.geometry.coordinates.map(function (xy) {
        return [xy[1] / (width / 2) - 1.0, xy[0] / (height / 2) - 1]
      })
    })

    const sizes = spots.map(function (spot) {
      return spot.properties.radius
    })

    const getcolors = function (spots) {
      var base, scaled
      return spots.map(function (spot, i) {
        if (!state.geneSelection[_.indexOf(top, spot.properties.gene)]) {
          base = '#afafaf'
        } else {
          base = colorscale(spot.properties.gene)
        }
        scaled = d3color.color(base).darker(spot.properties.qual)
        return [scaled.r/255, scaled.g/255, scaled.b/255]
      })
    }
    var colors = getcolors(spots)

    regl.frame(() => {
      regl.clear({
        depth: 1,
        color: [0, 0, 0, 1]
      })
  
      if (state.showSpots) {
        drawSpots({
          distance: camera.distance, 
          colors: colors,
          sizes: sizes,
          positions: positions,
          count: positions.length,
          view: camera.view(),
          scale: scale
        })
      }

      if (state.showCircles) {
        drawCircles({
          distance: camera.distance, 
          colors: colors,
          sizes: sizes,
          positions: positions,
          count: positions.length,
          view: camera.view(),
          scale: scale
        })
      }
      
      drawBackground({
        background: texture,
        view: camera.view(),
        scale: scale
      })

      if (state.showRegions) {
        drawRegions(vertices.map(function (v) {
          return {
            distance: camera.distance, 
            color: [0.3, 0.3, 0.3],
            vertices: v,
            count: v.length,
            view: camera.view(),
            scale: scale
          }})
        )

        drawOutlines(vertices.map(function (v) {
          return {
            distance: camera.distance, 
            color: [0.2, 0.2, 0.2],
            vertices: v,
            count: v.length,
            view: camera.view(),
            scale: scale
          }})
        )
      }

      camera.tick()
    })
  }
})