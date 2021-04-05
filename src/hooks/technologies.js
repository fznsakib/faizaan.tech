import { useStaticQuery, graphql } from "gatsby";

export default function Technologies() {
  const technologies = useStaticQuery(graphql`
    query {
      allContentfulSkill(
        filter: { isLanguage: { eq: false } }
        sort: { fields: name, order: ASC }
      ) {
        edges {
          node {
            name
            image {
              file {
                url
              }
            }
          }
        }
      }
    }
  `);

  return technologies.allContentfulSkill.edges;
}
