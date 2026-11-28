import useLanguage from "./useLanguage";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="theme-toolbar">
      <label>
        Language / மொழி
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="en">English</option>
          <option value="ta">தமிழ்</option>
        </select>
      </label>
    </div>
  );
}