import { Highlight, themes } from 'prism-react-renderer';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

interface Props {
  code: string;
  language?: string;
  maxHeight?: number;
}

const LANG_MAP: Record<string, string> = {
  pyspark: 'python',
  python: 'python',
  scala: 'scala',
  sql: 'sql',
  terraform: 'hcl',
};

export default function SyntaxHighlighter({ code, language = 'sql', maxHeight = 500 }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const prismLang = LANG_MAP[language] || language;

  return (
    <Highlight theme={isDark ? themes.nightOwl : themes.nightOwlLight} code={code.trim()} language={prismLang}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <Box
          component="pre"
          sx={{
            ...style,
            m: 0,
            p: 2,
            borderRadius: 1.5,
            overflow: 'auto',
            maxHeight,
            fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
            fontSize: '0.83rem',
            lineHeight: 1.7,
          }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span style={{ display: 'inline-block', width: '2.5em', textAlign: 'right', marginRight: '1em', opacity: 0.35, userSelect: 'none' }}>
                {i + 1}
              </span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </Box>
      )}
    </Highlight>
  );
}
