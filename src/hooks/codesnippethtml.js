import { useStaticQuery , graphql } from "gatsby";

export default function CodeSnippetHTML(id) {
  const snippets = useStaticQuery(graphql`
    query {
      allContentfulCodeSnippet {
        edges {
          node {
            contentful_id
            childContentfulCodeSnippetBodyTextNode {
              childMarkdownRemark {
                html
              }
            }
          }
        } 
      }
    }
  `);

  const snippet_map = snippets.allContentfulCodeSnippet.edges;

  for (var i in snippet_map) {
    const node = snippet_map[i].node;

    if (node.contentful_id === id) {
      return node.childContentfulCodeSnippetBodyTextNode.childMarkdownRemark.html;
    }
  }
}
