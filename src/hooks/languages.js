import { useStaticQuery, graphql } from "gatsby";

export default function Languages() {
  const languages = useStaticQuery(graphql`
    query {
      allContentfulSkill(
        filter: { isLanguage: { eq: true } }
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

  return languages.allContentfulSkill.edges;
}
