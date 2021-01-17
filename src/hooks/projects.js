import { useStaticQuery, graphql } from "gatsby";

export default function Projects() {
  const info = useStaticQuery(graphql`
    query {
      allContentfulProject(sort: { fields: year, order: DESC }) {
        edges {
          node {
            name
            field
            year
            url
            technologies
            previewImage {
              file {
                url
              }
            }
          }
        }
      }
    }
  `);

  return info.allContentfulProject.edges;
}
