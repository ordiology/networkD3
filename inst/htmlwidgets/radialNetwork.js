HTMLWidgets.widget({

  name: "radialNetwork",
  type: "output",

  initialize: function(el, width, height) {

    var diameter = Math.min(
      el.getBoundingClientRect().width,
      el.getBoundingClientRect().height
    );

    // LO 2022-04-19: Changed width and height from 100% to 98% to avoid overflow
    d3.select(el).append("svg")
      .style("width", "98%")
      .style("height", "98%")
      .append("g")
      .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"
                         + " scale("+diameter/800+","+diameter/800+")");
    return d3.tree();

  },

  resize: function(el, width, height, tree) {
    // resize now handled by svg viewBox attribute
    /*
    var diameter = Math.min(parseInt(width),parseInt(height));
    var s = d3.select(el).selectAll("svg");
    s.attr("width", width).attr("height", height);
    tree.size([360, diameter/2 - parseInt(s.attr("margin"))]);
    var svg = d3.select(el).selectAll("svg").select("g");
    svg.attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"
                         + " scale("+diameter/800+","+diameter/800+")");
    */

  },

  renderValue: function(el, x, tree) {
    // x is a list with two elements, options and root; root must already be a
    // JSON array with the d3Tree root data

    var s = d3.select(el).selectAll("svg");

    // when re-rendering the svg, the viewBox attribute set in the code below, will
    // be affected by the previously set viewBox. This line ensures, that the
    // viewBox will always be calculated right.
    s.attr("viewBox", null);

    // margin handling
    //   set our default margin to be 20
    //   will override with x.options.margin if provided
    var margin = {top: 20, right: 20, bottom: 20, left: 20};
    //   go through each key of x.options.margin
    //   use this value if provided from the R side
    Object.keys(x.options.margin).map(function(ky){
      if(x.options.margin[ky] !== null) {
        margin[ky] = x.options.margin[ky];
      }
      // set the margin on the svg with css style
      // commenting this out since not correct
      //s.style(["margin",ky].join("-"), margin[ky]);
    });

    var diameter = Math.min(
      s.node().getBoundingClientRect().width - margin.right - margin.left,
      s.node().getBoundingClientRect().height - margin.top - margin.bottom
    );

    //added Math.max(1, ...) to avoid NaN values when dealing with nodes of depth 0.
    tree.size([360, diameter/2])
        .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / Math.max(1, a.depth); });

    // select the svg group element and remove existing children
    s.attr("pointer-events", "all").selectAll("*").remove();
    s.append("g")
     .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"
                         + " scale("+1+","+1+")");

    var svg = d3.select(el).selectAll("g");

    var root = d3.hierarchy(x.root);
    tree(root);

    var diagonal = function(d) {
        return "M" + project(d.x, d.y)
            + "C" + project(d.x, (d.y + d.parent.y) / 2)
            + " " + project(d.parent.x, (d.y + d.parent.y) / 2)
            + " " + project(d.parent.x, d.parent.y);
      };

    // draw links
    var link = svg.selectAll(".link")
                  .data(root.descendants().slice(1))
                  .enter().append("path")
                  .style("fill", "none")
                  .style("stroke", x.options.linkColour)
                  .style("opacity", "0.55")
                  .style("stroke-width", "1.5px")
                  .attr("d", diagonal);

    // draw nodes
    var node = svg.selectAll(".node")
                  .data(root.descendants())
                  .enter().append("g")
                  .attr("class", "node")
                  .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })
                  .on("mouseover", mouseover)
                  .on("mouseout", mouseout)
                  .on("click", click);

    // node circles
    // LO 2022-04-19: Take stroke/fill colour from data where available and the radius of the circle changed to 5.5 from 4.5
    node.append("circle")
        .attr("r", 5.5)
        .style("fill", function(d) {
          return d.data.nodeColour === undefined ? x.options.nodeColour : d.data.nodeColour;
        })
        .style("opacity", x.options.opacity)
        .style("stroke", function(d) {
          return d.data.nodeStroke === undefined ? x.options.nodeStroke : d.data.nodeStroke;
        })
        .style("stroke-width", "1.5px")
        .style("cursor", "default");

    // node text
    // LO 2022-04-20: Take text colour from data where available 
    node.append("text")
        .attr("dy", ".31em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
        .style("font", x.options.fontSize + "px " + x.options.fontFamily)
        .style("opacity", x.options.opacity)
        .style("fill", function(d) { 
          return d.data.textColour === undefined ? x.options.textColour : d.data.textColour;
        })
        .text(function(d) { return d.data.name; });

    // adjust viewBox to fit the bounds of our tree
    s.attr(
        "viewBox",
        [
          d3.min(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().left
            })
          ) - s.node().getBoundingClientRect().left - margin.right,
          d3.min(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().top
            })
          ) - s.node().getBoundingClientRect().top - margin.top,
          d3.max(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().right
            })
          ) -
          d3.min(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().left
            })
          ) + margin.left + margin.right,
          d3.max(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().bottom
            })
          ) -
          d3.min(
            s.selectAll('.node text').nodes().map(function(d){
              return d.getBoundingClientRect().top
            })
          ) + margin.top + margin.bottom
        ].join(",")
      );


    // mouseover event handler
    // LO 2022-04-19: Changed mouseover font size from 25px to 1.5 times the original font size, changed node colour using d.data.strokeHover if defined or nodeStrokeHover if not, and translated the text 11 instead of 8
    function mouseover() {
      
      d3.select(this).select("circle").transition()
        .duration(750)
        .attr("r", 9)
        .style("stroke", function(d) {
          return d.data.nodeStrokeHover === undefined ? x.options.nodeStrokeHover : d.data.nodeStrokeHover;
        })
        .style("fill", function(d) {
          return d.data.nodeColourHover === undefined ? x.options.nodeColourHover : d.data.nodeColourHover;
        })
        .style("cursor", function(d) {
          return d.data.nodeCursor === undefined ? x.options.nodeCursor : d.data.nodeCursor;
        });
      d3.select(this).select("text").transition()
        .duration(750)
        .attr("dy", ".31em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? "translate(11)" : "rotate(180)translate(-11)"; })
        .style("stroke-width", ".5px")
        .style("font", x.options.fontSize*1.5 + "px " + x.options.fontFamily)
        .style("opacity", 1);

    }

    // mouseout event handler
    // LO 2022-04-19: Changed node stroke colour back to original colour on mouseout and circle radius to 5.5 (instead of 4.5)
    function mouseout() {
      d3.select(this).select("circle").transition()
        .duration(750)
        .attr("r", 5.5)
        .style("stroke", function(d) {
          return d.data.nodeStroke === undefined ? x.options.nodeStroke : d.data.nodeStroke;
        })
        .style("fill", function(d) {
          return d.data.nodeColour === undefined ? x.options.nodeColour : d.data.nodeColour;
        });
      d3.select(this).select("text").transition()
        .duration(750)
        .attr("dy", ".31em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
        .style("font", x.options.fontSize + "px " + x.options.fontFamily)
        .style("opacity", x.options.opacity)
        .style("cursor", "default");
    }
    
    
    // LO 2022-04-19: Added click action option to allow js to be passed in
    function click(d) {
      return eval(x.options.clickAction)
    }

    // convert to radial coordinate system
    // taken from: https://bl.ocks.org/mbostock/4063550
    function project(x, y) {
      var angle = (x - 90) / 180 * Math.PI, radius = y;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    }
  },
});
