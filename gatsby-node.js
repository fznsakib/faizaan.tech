const path = require("path");

module.exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  // Get path to template
  const blogTemplate = path.resolve("./src/templates/post.js");

  // Await for response from graphql query
  const res = await graphql(`
    query {
      allContentfulBlogPost {
        edges {
          node {
            slug
          }
        }
      }
    }
  `);

  // Create page for each markdown post
  res.data.allContentfulBlogPost.edges.forEach((edge) => {
    createPage({
      component: blogTemplate,
      path: `/blog/${edge.node.slug}`,
      context: {
        slug: edge.node.slug,
      },
    });
  });
};
