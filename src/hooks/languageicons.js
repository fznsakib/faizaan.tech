import { useStaticQuery, graphql } from "gatsby";

export default function LanguageIcons() {
  const icons = useStaticQuery(graphql`
    query {
      allFile(
        filter: { relativeDirectory: { eq: "images/languages" } }
        sort: { fields: name, order: ASC }
      ) {
        edges {
          node {
            name
            publicURL
          }
        }
      }
    }
  `);

  return icons.allFile.edges;
}
