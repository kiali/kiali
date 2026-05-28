import { Prompt } from 'types/Chatbot';

export const DataPrompts: { [key: string]: Prompt[] } = {
  graph: [
    {
      description: 'Show me the current status of my service mesh graph',
      message: 'Show me the current status of my service mesh graph',
      query: 'Check my graph',
      title: 'Check Graph Status'
    }
  ],
  overview: [
    {
      description: 'Give me a summary of the overall health of my mesh from the overview page',
      message: 'Give me a summary of the overall health of my mesh from the overview page',
      query: 'Check my overview',
      title: 'Analyze Overview'
    }
  ]
};
