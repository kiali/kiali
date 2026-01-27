import { Prompt } from 'types/Chatbot';

export const DataPrompts: { [key: string]: Prompt[] } = {
  graph: [
    {
      title: 'Check Graph Status',
      message: 'Show me the current status of my service mesh graph',
      query: 'Check my graph'
    }
  ],
  overview: [
    {
      title: 'Analyze Overview',
      message: 'Give me a summary of the overall health of my mesh from the overview page',
      query: 'Check my overview'
    }
  ]
};
